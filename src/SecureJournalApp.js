import React, { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { read, utils } from 'xlsx';

const SecureJournalApp = () => {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [therapistEmail, setTherapistEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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
      setErrorMessage('Please fill in all fields');
      return;
    }

    try {
      setStatus('processing');
      setStatusMessage('Processing your file...');
      
      const pdfFile = await convertToPDF(file);
      
      setStatus('encrypting');
      setStatusMessage('Encrypting your file...');
      const encryptedFile = await encryptFile(pdfFile, password);
      
      const formData = new FormData();
      formData.append('file', encryptedFile);
      formData.append('therapistEmail', therapistEmail);
      formData.append('originalFileName', file.name);
      
      setStatus('sending');
      setStatusMessage('Sending to your therapist...');
      
      const response = await fetch('https://wertnerve.pythonanywhere.com/api/journal_app_backend', {
        method: 'POST',
        body: formData,
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send file');
      }
      
      setStatus('success');
      setStatusMessage('File sent successfully!');
      // Clear form after success
      setFile(null);
      setPassword('');
      setTherapistEmail('');
      
    } catch (error) {
      console.error('Error processing file:', error);
      setStatus('error');
      setErrorMessage(error.message || 'An error occurred while processing your request');
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
          disabled={['processing', 'encrypting', 'sending'].includes(status)}
        >
          {status === 'processing' ? 'Processing...' :
           status === 'encrypting' ? 'Encrypting...' :
           status === 'sending' ? 'Sending...' :
           'Upload and Share'}
        </button>
      </form>

      {status === 'success' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <span>{statusMessage}</span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {['processing', 'encrypting', 'sending'].includes(status) && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <span>{statusMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecureJournalApp;
