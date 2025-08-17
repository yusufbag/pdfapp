#!/usr/bin/env python3
"""
PDF Görüntüleyici Backend API Test Suite
Tests all backend API endpoints for the PDF viewer application
"""

import requests
import json
import base64
import os
from datetime import datetime
import uuid

# Backend URL from frontend/.env
BACKEND_URL = "https://pdfpocket.preview.emergentagent.com/api"

class PDFBackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.test_pdf_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        print()

    def test_health_check(self):
        """Test GET /api/ - Health check"""
        try:
            response = self.session.get(f"{self.base_url}/")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "status" in data:
                    self.log_test("Health Check", True, f"API is active: {data['message']}")
                    return True
                else:
                    self.log_test("Health Check", False, "Response missing required fields")
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False

    def test_get_all_pdfs(self):
        """Test GET /api/pdfs - Get all PDFs"""
        try:
            response = self.session.get(f"{self.base_url}/pdfs")
            
            if response.status_code == 200:
                pdfs = response.json()
                if isinstance(pdfs, list):
                    self.log_test("Get All PDFs", True, f"Retrieved {len(pdfs)} PDFs")
                    return True
                else:
                    self.log_test("Get All PDFs", False, "Response is not a list")
                    return False
            else:
                self.log_test("Get All PDFs", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get All PDFs", False, f"Exception: {str(e)}")
            return False

    def test_create_pdf(self):
        """Test POST /api/pdfs - Create PDF"""
        try:
            # Create test PDF data
            pdf_data = {
                "name": "Test Kitap - Python Programlama",
                "uri": "https://example.com/python-kitabi.pdf",
                "size": 2048576,
                "type": "url"
            }
            
            response = self.session.post(
                f"{self.base_url}/pdfs",
                json=pdf_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                created_pdf = response.json()
                if "id" in created_pdf and "name" in created_pdf:
                    self.test_pdf_id = created_pdf["id"]  # Store for later tests
                    self.log_test("Create PDF", True, f"Created PDF with ID: {self.test_pdf_id}")
                    return True
                else:
                    self.log_test("Create PDF", False, "Response missing required fields")
                    return False
            else:
                self.log_test("Create PDF", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create PDF", False, f"Exception: {str(e)}")
            return False

    def test_get_specific_pdf(self):
        """Test GET /api/pdfs/{id} - Get specific PDF"""
        if not self.test_pdf_id:
            self.log_test("Get Specific PDF", False, "No test PDF ID available")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/pdfs/{self.test_pdf_id}")
            
            if response.status_code == 200:
                pdf = response.json()
                if "id" in pdf and pdf["id"] == self.test_pdf_id:
                    self.log_test("Get Specific PDF", True, f"Retrieved PDF: {pdf['name']}")
                    return True
                else:
                    self.log_test("Get Specific PDF", False, "PDF ID mismatch")
                    return False
            elif response.status_code == 404:
                self.log_test("Get Specific PDF", False, "PDF not found")
                return False
            else:
                self.log_test("Get Specific PDF", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Specific PDF", False, f"Exception: {str(e)}")
            return False

    def test_update_pdf(self):
        """Test PUT /api/pdfs/{id} - Update PDF"""
        if not self.test_pdf_id:
            self.log_test("Update PDF", False, "No test PDF ID available")
            return False
            
        try:
            update_data = {
                "name": "Güncellenmiş Kitap - Python İleri Seviye"
            }
            
            response = self.session.put(
                f"{self.base_url}/pdfs/{self.test_pdf_id}",
                json=update_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                updated_pdf = response.json()
                if updated_pdf["name"] == update_data["name"]:
                    self.log_test("Update PDF", True, f"Updated PDF name to: {updated_pdf['name']}")
                    return True
                else:
                    self.log_test("Update PDF", False, "PDF name not updated correctly")
                    return False
            elif response.status_code == 404:
                self.log_test("Update PDF", False, "PDF not found")
                return False
            else:
                self.log_test("Update PDF", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Update PDF", False, f"Exception: {str(e)}")
            return False

    def test_toggle_favorite(self):
        """Test PATCH /api/pdfs/{id}/favorite - Toggle favorite status"""
        if not self.test_pdf_id:
            self.log_test("Toggle Favorite", False, "No test PDF ID available")
            return False
            
        try:
            response = self.session.patch(f"{self.base_url}/pdfs/{self.test_pdf_id}/favorite")
            
            if response.status_code == 200:
                updated_pdf = response.json()
                if "isFavorite" in updated_pdf:
                    favorite_status = updated_pdf["isFavorite"]
                    self.log_test("Toggle Favorite", True, f"Favorite status: {favorite_status}")
                    return True
                else:
                    self.log_test("Toggle Favorite", False, "Response missing isFavorite field")
                    return False
            elif response.status_code == 404:
                self.log_test("Toggle Favorite", False, "PDF not found")
                return False
            else:
                self.log_test("Toggle Favorite", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Toggle Favorite", False, f"Exception: {str(e)}")
            return False

    def test_get_favorites(self):
        """Test GET /api/pdfs/favorites - Get favorite PDFs"""
        try:
            response = self.session.get(f"{self.base_url}/pdfs/favorites")
            
            if response.status_code == 200:
                favorites = response.json()
                if isinstance(favorites, list):
                    # Check if all returned PDFs are favorites
                    all_favorites = all(pdf.get("isFavorite", False) for pdf in favorites)
                    if all_favorites:
                        self.log_test("Get Favorites", True, f"Retrieved {len(favorites)} favorite PDFs")
                        return True
                    else:
                        self.log_test("Get Favorites", False, "Some returned PDFs are not favorites")
                        return False
                else:
                    self.log_test("Get Favorites", False, "Response is not a list")
                    return False
            else:
                self.log_test("Get Favorites", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Favorites", False, f"Exception: {str(e)}")
            return False

    def test_add_pdf_from_url(self):
        """Test POST /api/pdfs/from-url - Add PDF from URL"""
        try:
            url_data = {
                "url": "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf"
            }
            
            response = self.session.post(
                f"{self.base_url}/pdfs/from-url",
                json=url_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                created_pdf = response.json()
                if "id" in created_pdf and "uri" in created_pdf:
                    self.log_test("Add PDF from URL", True, f"Added PDF from URL: {created_pdf['name']}")
                    return True
                else:
                    self.log_test("Add PDF from URL", False, "Response missing required fields")
                    return False
            else:
                self.log_test("Add PDF from URL", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Add PDF from URL", False, f"Exception: {str(e)}")
            return False

    def test_upload_pdf_file(self):
        """Test POST /api/pdfs/upload - Upload PDF file"""
        try:
            # Create a minimal PDF content for testing
            pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n174\n%%EOF"
            
            files = {
                'file': ('test-document.pdf', pdf_content, 'application/pdf')
            }
            
            response = self.session.post(f"{self.base_url}/pdfs/upload", files=files)
            
            if response.status_code == 200:
                uploaded_pdf = response.json()
                if "id" in uploaded_pdf and "fileData" in uploaded_pdf:
                    self.log_test("Upload PDF File", True, f"Uploaded PDF: {uploaded_pdf['name']}")
                    return True
                else:
                    self.log_test("Upload PDF File", False, "Response missing required fields")
                    return False
            else:
                self.log_test("Upload PDF File", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Upload PDF File", False, f"Exception: {str(e)}")
            return False

    def test_get_stats(self):
        """Test GET /api/stats - Get PDF statistics"""
        try:
            response = self.session.get(f"{self.base_url}/stats")
            
            if response.status_code == 200:
                stats = response.json()
                required_fields = ["totalPdfs", "favoritePdfs", "localPdfs", "cloudPdfs", "urlPdfs"]
                
                if all(field in stats for field in required_fields):
                    self.log_test("Get Statistics", True, f"Total PDFs: {stats['totalPdfs']}, Favorites: {stats['favoritePdfs']}")
                    return True
                else:
                    missing_fields = [field for field in required_fields if field not in stats]
                    self.log_test("Get Statistics", False, f"Missing fields: {missing_fields}")
                    return False
            else:
                self.log_test("Get Statistics", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Statistics", False, f"Exception: {str(e)}")
            return False

    def test_pdf_view_endpoint(self):
        """Test GET /api/pdfs/{id}/view - PDF viewing endpoint (CRITICAL FOR PDF.js)"""
        if not self.test_pdf_id:
            self.log_test("PDF View Endpoint", False, "No test PDF ID available")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/pdfs/{self.test_pdf_id}/view")
            
            if response.status_code == 200:
                # Check if response is PDF content or redirect
                content_type = response.headers.get('content-type', '').lower()
                
                if 'application/pdf' in content_type:
                    # Direct PDF content returned
                    content_length = len(response.content)
                    self.log_test("PDF View Endpoint", True, f"PDF content returned directly, size: {content_length} bytes, Content-Type: {content_type}")
                    return True
                elif response.status_code == 302 or 'text/html' in content_type:
                    # Redirect response for external URLs
                    self.log_test("PDF View Endpoint", True, f"Redirect response for external URL, Content-Type: {content_type}")
                    return True
                else:
                    self.log_test("PDF View Endpoint", False, f"Unexpected content type: {content_type}")
                    return False
            elif response.status_code == 404:
                self.log_test("PDF View Endpoint", False, "PDF not found for viewing")
                return False
            else:
                self.log_test("PDF View Endpoint", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("PDF View Endpoint", False, f"Exception: {str(e)}")
            return False

    def test_pdf_view_with_base64_data(self):
        """Test PDF viewing with base64 data (uploaded PDF)"""
        try:
            # First create a PDF with base64 data
            pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n174\n%%EOF"
            
            files = {
                'file': ('test-view-document.pdf', pdf_content, 'application/pdf')
            }
            
            # Upload PDF
            upload_response = self.session.post(f"{self.base_url}/pdfs/upload", files=files)
            
            if upload_response.status_code != 200:
                self.log_test("PDF View with Base64", False, "Failed to upload test PDF")
                return False
                
            uploaded_pdf = upload_response.json()
            pdf_id = uploaded_pdf["id"]
            
            # Now test viewing this PDF
            view_response = self.session.get(f"{self.base_url}/pdfs/{pdf_id}/view")
            
            if view_response.status_code == 200:
                content_type = view_response.headers.get('content-type', '').lower()
                
                if 'application/pdf' in content_type:
                    # Verify the PDF content is returned correctly
                    returned_content = view_response.content
                    if len(returned_content) > 0 and returned_content.startswith(b'%PDF'):
                        self.log_test("PDF View with Base64", True, f"Base64 PDF correctly decoded and returned, size: {len(returned_content)} bytes")
                        
                        # Clean up - delete the test PDF
                        self.session.delete(f"{self.base_url}/pdfs/{pdf_id}")
                        return True
                    else:
                        self.log_test("PDF View with Base64", False, "Invalid PDF content returned")
                        return False
                else:
                    self.log_test("PDF View with Base64", False, f"Wrong content type: {content_type}")
                    return False
            else:
                self.log_test("PDF View with Base64", False, f"HTTP {view_response.status_code}: {view_response.text}")
                return False
                
        except Exception as e:
            self.log_test("PDF View with Base64", False, f"Exception: {str(e)}")
            return False

    def test_pdf_view_with_url(self):
        """Test PDF viewing with external URL"""
        try:
            # Create a PDF from URL
            url_data = {
                "url": "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf"
            }
            
            create_response = self.session.post(
                f"{self.base_url}/pdfs/from-url",
                json=url_data,
                headers={"Content-Type": "application/json"}
            )
            
            if create_response.status_code != 200:
                self.log_test("PDF View with URL", False, "Failed to create PDF from URL")
                return False
                
            created_pdf = create_response.json()
            pdf_id = created_pdf["id"]
            
            # Now test viewing this PDF
            view_response = self.session.get(f"{self.base_url}/pdfs/{pdf_id}/view", allow_redirects=False)
            
            if view_response.status_code in [200, 302, 307, 308]:
                if view_response.status_code == 302:
                    # Should redirect to the original URL
                    location = view_response.headers.get('location', '')
                    if url_data["url"] in location:
                        self.log_test("PDF View with URL", True, f"Correctly redirected to: {location}")
                        
                        # Clean up - delete the test PDF
                        self.session.delete(f"{self.base_url}/pdfs/{pdf_id}")
                        return True
                    else:
                        self.log_test("PDF View with URL", False, f"Wrong redirect location: {location}")
                        return False
                else:
                    # Direct content returned
                    self.log_test("PDF View with URL", True, f"PDF content returned directly, status: {view_response.status_code}")
                    
                    # Clean up - delete the test PDF
                    self.session.delete(f"{self.base_url}/pdfs/{pdf_id}")
                    return True
            else:
                self.log_test("PDF View with URL", False, f"HTTP {view_response.status_code}: {view_response.text}")
                return False
                
        except Exception as e:
            self.log_test("PDF View with URL", False, f"Exception: {str(e)}")
            return False

    def test_pdf_view_error_scenarios(self):
        """Test PDF view endpoint error scenarios"""
        print("=== Testing PDF View Error Scenarios ===")
        
        # Test invalid PDF ID for view
        try:
            response = self.session.get(f"{self.base_url}/pdfs/invalid-view-id-12345/view")
            if response.status_code == 404:
                self.log_test("PDF View Invalid ID", True, "Correctly returned 404 for invalid PDF ID")
            else:
                self.log_test("PDF View Invalid ID", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("PDF View Invalid ID", False, f"Exception: {str(e)}")

        # Test view endpoint with non-existent UUID
        try:
            fake_uuid = str(uuid.uuid4())
            response = self.session.get(f"{self.base_url}/pdfs/{fake_uuid}/view")
            if response.status_code == 404:
                self.log_test("PDF View Non-existent UUID", True, "Correctly returned 404 for non-existent UUID")
            else:
                self.log_test("PDF View Non-existent UUID", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("PDF View Non-existent UUID", False, f"Exception: {str(e)}")

    def test_delete_pdf(self):
        """Test DELETE /api/pdfs/{id} - Delete PDF"""
        if not self.test_pdf_id:
            self.log_test("Delete PDF", False, "No test PDF ID available")
            return False
            
        try:
            response = self.session.delete(f"{self.base_url}/pdfs/{self.test_pdf_id}")
            
            if response.status_code == 200:
                result = response.json()
                if "message" in result and result.get("id") == self.test_pdf_id:
                    self.log_test("Delete PDF", True, f"Deleted PDF with ID: {self.test_pdf_id}")
                    return True
                else:
                    self.log_test("Delete PDF", False, "Response missing required fields")
                    return False
            elif response.status_code == 404:
                self.log_test("Delete PDF", False, "PDF not found")
                return False
            else:
                self.log_test("Delete PDF", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete PDF", False, f"Exception: {str(e)}")
            return False

    def test_error_scenarios(self):
        """Test error scenarios"""
        print("=== Testing Error Scenarios ===")
        
        # Test invalid PDF ID
        try:
            response = self.session.get(f"{self.base_url}/pdfs/invalid-id-12345")
            if response.status_code == 404:
                self.log_test("Invalid PDF ID Error", True, "Correctly returned 404 for invalid ID")
            else:
                self.log_test("Invalid PDF ID Error", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Invalid PDF ID Error", False, f"Exception: {str(e)}")

        # Test empty body for PDF creation
        try:
            response = self.session.post(f"{self.base_url}/pdfs", json={})
            if response.status_code in [400, 422]:  # Bad request or validation error
                self.log_test("Empty Body Error", True, "Correctly rejected empty body")
            else:
                self.log_test("Empty Body Error", False, f"Expected 400/422, got {response.status_code}")
        except Exception as e:
            self.log_test("Empty Body Error", False, f"Exception: {str(e)}")

        # Test invalid URL for from-url endpoint
        try:
            response = self.session.post(f"{self.base_url}/pdfs/from-url", json={})
            if response.status_code == 400:
                self.log_test("Missing URL Error", True, "Correctly rejected missing URL")
            else:
                self.log_test("Missing URL Error", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_test("Missing URL Error", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("=== PDF Görüntüleyici Backend API Test Suite ===")
        print(f"Testing backend at: {self.base_url}")
        print()
        
        # Test sequence - PDF viewing tests are prioritized
        tests = [
            self.test_health_check,
            self.test_get_all_pdfs,
            self.test_create_pdf,
            self.test_get_specific_pdf,
            self.test_pdf_view_endpoint,  # CRITICAL: Test PDF viewing
            self.test_pdf_view_with_base64_data,  # CRITICAL: Test base64 PDF viewing
            self.test_pdf_view_with_url,  # CRITICAL: Test URL PDF viewing
            self.test_update_pdf,
            self.test_toggle_favorite,
            self.test_get_favorites,
            self.test_add_pdf_from_url,
            self.test_upload_pdf_file,
            self.test_get_stats,
            self.test_delete_pdf,
            self.test_error_scenarios,
            self.test_pdf_view_error_scenarios  # Test PDF view error cases
        ]
        
        passed = 0
        total = 0
        
        for test in tests:
            if test():
                passed += 1
            total += 1
        
        print("=== Test Summary ===")
        print(f"Passed: {passed}/{total}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Print detailed results
        print("\n=== Detailed Results ===")
        for result in self.test_results:
            print(f"{result['status']}: {result['test']}")
            if result['details']:
                print(f"   {result['details']}")
        
        return passed, total

if __name__ == "__main__":
    tester = PDFBackendTester()
    passed, total = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if passed == total else 1)