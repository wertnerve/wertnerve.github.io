import React, { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { read, utils } from 'xlsx';

const SecureJournalApp = () => {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [therapistEmail, setTherapistEmail] = useState('');

  // Rest of your existing functions (convertToPDF, getKeyFromPassword, encryptFile) remain the same

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
      const pdfFile = await convertToPDF(file);
      setStatus('encrypting');
      const encryptedFile = await encryptFile(pdfFile, password);
      
      const formData = new FormData();
      formData.append('file', encryptedFile);
      formData.append('therapistEmail', therapistEmail);
      formData.append('originalFileName', file.name);
      
      setStatus('sending');
      const response = await fetch('https://wertnerve.pythonanywhere.com/api/journal_app_backend', {
        method: 'POST',
        body: formData,
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
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
          File has been encrypted and sent to your therapist successfully!
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          There was an error processing your request. Please ensure all fields are filled and try again.
        </div>
      )}
    </div>
  );
};

export default SecureJournalApp;
