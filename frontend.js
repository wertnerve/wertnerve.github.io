import React, { useState, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload } from 'lucide-react';
import { read, utils } from 'xlsx';  // For handling .doc/.docx files

const SecureJournalApp = () => {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [therapistEmail, setTherapistEmail] = useState('');

  // Convert document to PDF if needed
  const convertToPDF = async (file) => {
    if (file.type === 'application/pdf') {
      return file;
    }
    
    // If it's a .doc/.docx file
    if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const textContent = utils.sheet_to_text(worksheet);
      
      // Create a simple PDF-like structure with the text content
      const pdfBlob = new Blob([textContent], { type: 'application/pdf' });
      return new File([pdfBlob], file.name.replace(/\.(doc|docx)$/, '.pdf'), { type: 'application/pdf' });
    }
    
    return file;
  };

  // Generate encryption key from password
  const getKeyFromPassword = async (password, salt) => {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt']
    );
  };

  const encryptFile = useCallback(async (fileData, password) => {
    try {
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = async (e) => {
          try {
            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            const key = await getKeyFromPassword(password, salt);
            
            const fileContent = new Uint8Array(e.target.result);
            const encryptedContent = await window.crypto.subtle.encrypt(
              {
                name: 'AES-GCM',
                iv: iv
              },
              key,
              fileContent
            );

            // Create a new file with the encrypted content
            const encryptedBlob = new Blob([salt, iv, new Uint8Array(encryptedContent)]);
            const encryptedFile = new File(
              [encryptedBlob], 
              `encrypted_${fileData.name}`,
              { type: 'application/encrypted' }
            );

            resolve(encryptedFile);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(fileData);
      });
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }, []);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file || !password || !therapistEmail) {
      setStatus('error');
      return;
    }

    try {
      setStatus('processing');
      
      // Convert to PDF if needed
      const pdfFile = await convertToPDF(file);
      
      // Encrypt the file
      setStatus('encrypting');
      const encryptedFile = await encryptFile(pdfFile, password);
      
      // Create form data for email sending
      const formData = new FormData();
      formData.append('file', encryptedFile);
      formData.append('therapistEmail', therapistEmail);
      formData.append('originalFileName', file.name);
      
      // Send email with encrypted file
      setStatus('sending');
      const response = await fetch('https://wertnerve.pythonanywhere.com/api/journal_app_backend', {
        method: 'POST',
        body: formData,
        // Add CORS headers
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }
      
      setStatus('success');
    } catch (error) {
      console.error('Error processing file:', error);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Secure Journal Sharing</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Upload Journal Entry
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".doc,.docx,.pdf"
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-12 h-12 text-gray-400" />
                <span className="mt-2 text-sm text-gray-600">
                  {file ? file.name : 'Click to upload or drag and drop'}
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Encryption Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Therapist's Email
            </label>
            <input
              type="email"
              value={therapistEmail}
              onChange={(e) => setTherapistEmail(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={status === 'processing' || status === 'encrypting' || status === 'sending'}
        >
          {status === 'processing' ? 'Processing...' :
           status === 'encrypting' ? 'Encrypting...' :
           status === 'sending' ? 'Sending...' :
           'Encrypt and Send'}
        </button>
      </form>

      {status === 'success' && (
        <Alert className="mt-4 bg-green-50 border-green-200">
          <AlertDescription>
            File has been encrypted and sent to your therapist successfully!
          </AlertDescription>
        </Alert>
      )}

      {status === 'error' && (
        <Alert className="mt-4 bg-red-50 border-red-200">
          <AlertDescription>
            There was an error processing your request. Please ensure all fields are filled and try again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default SecureJournalApp;