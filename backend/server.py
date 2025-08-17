from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import base64
import json


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'pdf_viewer_db')]

# Collections
pdfs_collection = db.pdfs
annotations_collection = db.annotations

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


# Define Models
class PDFFile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    uri: str
    size: int
    dateAdded: datetime = Field(default_factory=datetime.utcnow)
    isFavorite: bool = False
    type: str = "local"  # local, cloud, url
    fileData: Optional[str] = None  # base64 encoded file data
    thumbnailData: Optional[str] = None  # base64 encoded thumbnail

class PDFCreate(BaseModel):
    name: str
    uri: str
    size: int
    type: str = "local"
    fileData: Optional[str] = None

class PDFUpdate(BaseModel):
    name: Optional[str] = None
    isFavorite: Optional[bool] = None

# PDF Endpoints
@api_router.get("/pdfs", response_model=List[PDFFile])
async def get_pdfs():
    """Tüm PDF dosyalarını getir"""
    try:
        pdfs = await pdfs_collection.find().to_list(1000)
        return [PDFFile(**pdf) for pdf in pdfs]
    except Exception as e:
        logging.error(f"PDF'ler getirilirken hata: {e}")
        raise HTTPException(status_code=500, detail="PDF'ler getirilemedi")

@api_router.get("/pdfs/favorites", response_model=List[PDFFile])
async def get_favorite_pdfs():
    """Favori PDF dosyalarını getir"""
    try:
        pdfs = await pdfs_collection.find({"isFavorite": True}).to_list(1000)
        return [PDFFile(**pdf) for pdf in pdfs]
    except Exception as e:
        logging.error(f"Favori PDF'ler getirilirken hata: {e}")
        raise HTTPException(status_code=500, detail="Favori PDF'ler getirilemedi")

@api_router.get("/pdfs/{pdf_id}", response_model=PDFFile)
async def get_pdf(pdf_id: str):
    """Belirli bir PDF dosyasını getir"""
    try:
        pdf = await pdfs_collection.find_one({"id": pdf_id})
        if not pdf:
            raise HTTPException(status_code=404, detail="PDF bulunamadı")
        return PDFFile(**pdf)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"PDF getirilirken hata: {e}")
        raise HTTPException(status_code=500, detail="PDF getirilemedi")

@api_router.post("/pdfs", response_model=PDFFile)
async def create_pdf(pdf_data: PDFCreate):
    """Yeni PDF dosyası oluştur"""
    try:
        pdf_dict = pdf_data.dict()
        pdf_obj = PDFFile(**pdf_dict)
        
        # MongoDB'ye kaydet
        await pdfs_collection.insert_one(pdf_obj.dict())
        return pdf_obj
    except Exception as e:
        logging.error(f"PDF oluşturulurken hata: {e}")
        raise HTTPException(status_code=500, detail="PDF oluşturulamadı")

@api_router.patch("/pdfs/{pdf_id}/favorite", response_model=PDFFile)
async def toggle_favorite(pdf_id: str):
    """PDF'in favori durumunu değiştir"""
    try:
        # Önce mevcut PDF'i bul
        existing_pdf = await pdfs_collection.find_one({"id": pdf_id})
        if not existing_pdf:
            raise HTTPException(status_code=404, detail="PDF bulunamadı")
        
        # Favori durumunu tersine çevir
        new_favorite_status = not existing_pdf.get("isFavorite", False)
        
        # Güncelle
        await pdfs_collection.update_one(
            {"id": pdf_id},
            {"$set": {"isFavorite": new_favorite_status}}
        )
        
        # Güncellenmiş PDF'i getir
        updated_pdf = await pdfs_collection.find_one({"id": pdf_id})
        return PDFFile(**updated_pdf)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Favori durumu güncellenirken hata: {e}")
        raise HTTPException(status_code=500, detail="Favori durumu güncellenemedi")

@api_router.put("/pdfs/{pdf_id}", response_model=PDFFile)
async def update_pdf(pdf_id: str, pdf_update: PDFUpdate):
    """PDF dosyası bilgilerini güncelle"""
    try:
        # Güncellenecek alanları hazırla
        update_data = {k: v for k, v in pdf_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="Güncellenecek veri yok")
        
        # Güncelle
        result = await pdfs_collection.update_one(
            {"id": pdf_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="PDF bulunamadı")
        
        # Güncellenmiş PDF'i getir
        updated_pdf = await pdfs_collection.find_one({"id": pdf_id})
        return PDFFile(**updated_pdf)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"PDF güncellenirken hata: {e}")
        raise HTTPException(status_code=500, detail="PDF güncellenemedi")

@api_router.delete("/pdfs/{pdf_id}")
async def delete_pdf(pdf_id: str):
    """PDF dosyasını sil"""
    try:
        result = await pdfs_collection.delete_one({"id": pdf_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="PDF bulunamadı")
        
        return {"message": "PDF başarıyla silindi", "id": pdf_id}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"PDF silinirken hata: {e}")
        raise HTTPException(status_code=500, detail="PDF silinemedi")

@api_router.post("/pdfs/upload")
async def upload_pdf_file(file: UploadFile = File(...)):
    """PDF dosyası yükle"""
    try:
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Sadece PDF dosyaları yüklenebilir")
        
        # Dosyayı oku ve base64'e çevir
        file_content = await file.read()
        file_base64 = base64.b64encode(file_content).decode('utf-8')
        
        # PDF bilgilerini oluştur
        pdf_data = PDFCreate(
            name=file.filename or "Adsız PDF",
            uri=f"data:application/pdf;base64,{file_base64}",
            size=len(file_content),
            type="local",
            fileData=file_base64
        )
        
        # PDF'i kaydet
        pdf_obj = PDFFile(**pdf_data.dict())
        await pdfs_collection.insert_one(pdf_obj.dict())
        
        return pdf_obj
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Dosya yüklenirken hata: {e}")
        raise HTTPException(status_code=500, detail="Dosya yüklenemedi")

@api_router.post("/pdfs/from-url")
async def add_pdf_from_url(url_data: dict):
    """URL'den PDF ekle"""
    try:
        url = url_data.get("url")
        if not url:
            raise HTTPException(status_code=400, detail="URL gerekli")
        
        # URL'den dosya adını çıkar
        filename = url.split("/")[-1]
        if not filename.endswith(".pdf"):
            filename += ".pdf"
        
        pdf_data = PDFCreate(
            name=filename,
            uri=url,
            size=0,  # URL'den boyut bilinmiyor
            type="url"
        )
        
        pdf_obj = PDFFile(**pdf_data.dict())
        await pdfs_collection.insert_one(pdf_obj.dict())
        
        return pdf_obj
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"URL'den PDF eklenirken hata: {e}")
        raise HTTPException(status_code=500, detail="URL'den PDF eklenemedi")

# Stats endpoint
@api_router.get("/pdfs/{pdf_id}/view")
async def view_pdf(pdf_id: str):
    """PDF'i tarayıcıda görüntüleme için döndür"""
    try:
        pdf = await pdfs_collection.find_one({"id": pdf_id})
        if not pdf:
            raise HTTPException(status_code=404, detail="PDF bulunamadı")
        
        # Eğer base64 data varsa onu döndür
        if pdf.get("fileData"):
            # Base64 veriyi PDF olarak döndür
            import base64
            from fastapi.responses import Response
            
            pdf_bytes = base64.b64decode(pdf["fileData"])
            filename = pdf.get('name', 'document').encode('ascii', 'ignore').decode('ascii')
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"inline; filename=\"{filename}.pdf\"",
                    "Content-Length": str(len(pdf_bytes))
                }
            )
        elif pdf.get("uri", "").startswith("data:application/pdf;base64,"):
            # URI'de base64 data varsa onu çıkar ve döndür
            import base64
            from fastapi.responses import Response
            
            base64_data = pdf["uri"].split("data:application/pdf;base64,")[1]
            pdf_bytes = base64.b64decode(base64_data)
            filename = pdf.get('name', 'document').encode('ascii', 'ignore').decode('ascii')
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"inline; filename=\"{filename}.pdf\"",
                    "Content-Length": str(len(pdf_bytes))
                }
            )
        else:
            # External URL ise redirect et
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=pdf["uri"])
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"PDF görüntülenirken hata: {e}")
        raise HTTPException(status_code=500, detail="PDF görüntülenemedi")

@api_router.get("/stats")
async def get_stats():
    """PDF istatistikleri getir"""
    try:
        total_pdfs = await pdfs_collection.count_documents({})
        favorite_pdfs = await pdfs_collection.count_documents({"isFavorite": True})
        local_pdfs = await pdfs_collection.count_documents({"type": "local"})
        cloud_pdfs = await pdfs_collection.count_documents({"type": "cloud"})
        url_pdfs = await pdfs_collection.count_documents({"type": "url"})
        
        return {
            "totalPdfs": total_pdfs,
            "favoritePdfs": favorite_pdfs,
            "localPdfs": local_pdfs,
            "cloudPdfs": cloud_pdfs,
            "urlPdfs": url_pdfs
        }
    except Exception as e:
        logging.error(f"İstatistikler getirilirken hata: {e}")
        raise HTTPException(status_code=500, detail="İstatistikler getirilemedi")

# PDF annotations endpoints
@api_router.get("/pdfs/{pdf_id}/annotations")
async def get_pdf_annotations(pdf_id: str):
    """PDF'in tüm annotation'larını getir"""
    try:
        # PDF var mı kontrol et
        pdf = await pdfs_collection.find_one({"id": pdf_id})
        if not pdf:
            raise HTTPException(status_code=404, detail="PDF bulunamadı")
        
        # Annotations'ları getir
        annotations = []
        async for annotation in annotations_collection.find(
            {"pdf_id": pdf_id}
        ):
            # MongoDB _id'sini çıkar
            if "_id" in annotation:
                del annotation["_id"]
            annotations.append(annotation)
        
        return {"annotations": annotations}
        
    except Exception as e:
        logging.error(f"Annotations getirme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail="Annotations getirilemedi")

@api_router.post("/pdfs/{pdf_id}/annotations")
async def add_pdf_annotation(pdf_id: str, annotation_data: dict):
    """PDF'e yeni annotation ekle"""
    try:
        # PDF var mı kontrol et
        pdf = await pdfs_collection.find_one({"id": pdf_id})
        if not pdf:
            raise HTTPException(status_code=404, detail="PDF bulunamadı")
        
        # Annotation oluştur
        annotation = {
            "id": str(uuid.uuid4()),
            "pdf_id": pdf_id,
            "type": annotation_data.get("type", "text"),  # text, highlight, drawing
            "x": annotation_data.get("x", 0),
            "y": annotation_data.get("y", 0),
            "width": annotation_data.get("width", 0),
            "height": annotation_data.get("height", 0),
            "page": annotation_data.get("page", 1),
            "content": annotation_data.get("content", ""),
            "color": annotation_data.get("color", "#FFFF00"),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # Veritabanına kaydet
        result = await annotations_collection.insert_one(annotation)
        
        if result.inserted_id:
            return {"message": "Annotation başarıyla eklendi", "annotation": annotation}
        else:
            raise HTTPException(status_code=500, detail="Annotation eklenemedi")
            
    except Exception as e:
        logging.error(f"Annotation ekleme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail="Annotation eklenemedi")

@api_router.put("/pdfs/{pdf_id}/annotations/{annotation_id}")
async def update_pdf_annotation(pdf_id: str, annotation_id: str, annotation_data: dict):
    """PDF annotation'ını güncelle"""
    try:
        # Annotation var mı kontrol et
        existing_annotation = await annotations_collection.find_one({
            "id": annotation_id, 
            "pdf_id": pdf_id
        })
        
        if not existing_annotation:
            raise HTTPException(status_code=404, detail="Annotation bulunamadı")
        
        # Güncellenecek alanlar
        update_data = {
            "content": annotation_data.get("content", existing_annotation.get("content")),
            "x": annotation_data.get("x", existing_annotation.get("x")),
            "y": annotation_data.get("y", existing_annotation.get("y")),
            "color": annotation_data.get("color", existing_annotation.get("color")),
            "updated_at": datetime.now().isoformat()
        }
        
        # Güncelle
        result = await annotations_collection.update_one(
            {"id": annotation_id, "pdf_id": pdf_id},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            return {"message": "Annotation başarıyla güncellendi"}
        else:
            raise HTTPException(status_code=500, detail="Annotation güncellenemedi")
            
    except Exception as e:
        logging.error(f"Annotation güncelleme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail="Annotation güncellenemedi")

@api_router.delete("/pdfs/{pdf_id}/annotations/{annotation_id}")
async def delete_pdf_annotation(pdf_id: str, annotation_id: str):
    """PDF annotation'ını sil"""
    try:
        # Annotation var mı kontrol et ve sil
        result = await annotations_collection.delete_one({
            "id": annotation_id, 
            "pdf_id": pdf_id
        })
        
        if result.deleted_count > 0:
            return {"message": "Annotation başarıyla silindi"}
        else:
            raise HTTPException(status_code=404, detail="Annotation bulunamadı")
            
    except Exception as e:
        logging.error(f"Annotation silme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail="Annotation silinemedi")

# Health check
@api_router.get("/")
async def root():
    return {"message": "PDF Görüntüleyici API aktif", "status": "ok"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()