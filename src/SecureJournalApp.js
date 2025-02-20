import React, { useState } from 'react';
import { Upload } from 'lucide-react';

const SecureJournalApp = () => {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [therapistEmail, setTherapistEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setStatus('');
      } else {
        setStatus('error');
        setStatusMessage('Please upload a PDF file');
        event.target.value = '';
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file || !password || !therapistEmail) {
      setStatus('error');
      setStatusMessage('Please fill in all fields');
      return;
    }

    try {
      setStatus('sending');
      setStatusMessage('Sending your protected PDF...');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('therapistEmail', therapistEmail);
      formData.append('password', password);
      
      const response = await fetch('https://wertnerve.pythonanywhere.com/api/journal_app_backend', {
        method: 'POST',
        body: formData,
        mode: 'cors',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send file');
      }
      
      setStatus('success');
      setStatusMessage('PDF sent successfully!');
      
      // Clear form
      setFile(null);
      setPassword('');
      setTherapistEmail('');
      
      // Reset file input
      document.getElementById('file-upload').value = '';
      
    } catch (error) {
      console.error('Error:', error);
      setStatus('error');
      setStatusMessage(error.message || 'An error occurred while sending your file');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Secure Journal Sharing</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Upload Journal Entry (PDF only)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf"
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  {file ? file.name : 'Click to upload or drag and drop'}
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              PDF Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md"
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
              className="w-full p-3 border border-gray-300 rounded-md"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          disabled={status === 'sending'}
        >
          {status === 'sending' ? 'Sending...' : 'Upload and Share'}
        </button>
      </form>

      {status && (
        <div className={`mt-4 p-4 rounded-md ${
          status === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          status === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {statusMessage}
        </div>
      )}
    </div>
  );
};

export default SecureJournalApp;
