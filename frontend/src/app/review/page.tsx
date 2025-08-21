'use client';

import { useState, useEffect, useRef } from 'react';
import LocationCard from '@/components/LocationCard';

// Valid service categories from config
const VALID_SERVICE_CATEGORIES = [
  'Teeth',
  'Cosmetics',
  'Waxing',
  'Brows',
  'Hair',
  'Tan',
  'Skin',
  'Laser',
  'Spa',
  'Lashes',
  'Nails',
  'Makeup'
];

// const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function SalonReviewPage() {
  const [salons, setSalons] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [salonStatuses, setSalonStatuses] = useState<Record<number, string>>({});
  const [viewMode, setViewMode] = useState<'individual' | 'list'>('individual');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('salonReview_data');
    const savedStatuses = localStorage.getItem('salonReview_statuses');
    
    if (savedData && savedStatuses) {
      try {
        setSalons(JSON.parse(savedData));
        setSalonStatuses(JSON.parse(savedStatuses));
      } catch (e) {
        console.error('Error loading saved data:', e);
      }
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (salons.length > 0) {
      localStorage.setItem('salonReview_data', JSON.stringify(salons));
      localStorage.setItem('salonReview_statuses', JSON.stringify(salonStatuses));
    }
  }, [salons, salonStatuses]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (Array.isArray(data)) {
          setSalons(data);
          // Initialize statuses
          const newStatuses: Record<number, string> = {};
          data.forEach((_, index) => {
            newStatuses[index] = salonStatuses[index] || 'pending';
          });
          setSalonStatuses(newStatuses);
          setCurrentIndex(0);
        }
      } catch (error) {
        alert('Error loading file: ' + error);
      }
    };
    reader.readAsText(file);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || currentIndex >= salons.length) return;

    setUploadingImage(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('salonName', salons[currentIndex].name || 'unknown');

      const response = await fetch('/api/blob/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.url) {
        // Update current salon's thumbnails
        const updatedSalons = [...salons];
        if (!updatedSalons[currentIndex].thumbnails) {
          updatedSalons[currentIndex].thumbnails = [];
        }
        updatedSalons[currentIndex].thumbnails.push(data.url);
        setSalons(updatedSalons);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async (imageUrl: string) => {
    if (!confirm('Delete this image?')) return;

    try {
      const response = await fetch('/api/blob/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl }),
      });

      if (response.ok) {
        // Remove from current salon
        const updatedSalons = [...salons];
        updatedSalons[currentIndex].thumbnails = updatedSalons[currentIndex].thumbnails?.filter(
          (url: string) => url !== imageUrl
        );
        setSalons(updatedSalons);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete image');
    }
  };

  const updateSalonField = (field: string, value: any) => {
    const updatedSalons = [...salons];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (!updatedSalons[currentIndex][parent]) {
        updatedSalons[currentIndex][parent] = {};
      }
      updatedSalons[currentIndex][parent][child] = value;
    } else {
      updatedSalons[currentIndex][field] = value;
    }
    setSalons(updatedSalons);
  };

  const updateStatus = (status: 'approved' | 'rejected' | 'pending') => {
    setSalonStatuses({ ...salonStatuses, [currentIndex]: status });
    if (currentIndex < salons.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const exportData = () => {
    const exportData = salons.map((salon, index) => ({
      ...salon,
      _meta: { ...salon._meta, reviewStatus: salonStatuses[index] || 'pending' }
    })).filter((_, index) => salonStatuses[index] !== 'rejected');

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `salon-results-reviewed-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isVercelBlobUrl = (url: string) => {
    return url && (url.includes('.public.blob.vercel-storage.com') || url.includes('.blob.core.windows.net'));
  };

  const currentSalon = salons[currentIndex] || null;
  const vercelThumbnails = currentSalon?.thumbnails?.filter(isVercelBlobUrl) || [];

  const stats = {
    total: salons.length,
    approved: Object.values(salonStatuses).filter(s => s === 'approved').length,
    rejected: Object.values(salonStatuses).filter(s => s === 'rejected').length,
    pending: salons.length - Object.values(salonStatuses).filter(s => s === 'approved' || s === 'rejected').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Compact Header */}
        <div className="bg-white rounded-lg shadow-sm px-5 py-3 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold">Salon Data Review & Editor</h1>
              
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Upload salon-results.json
                </button>

                {salons.length > 0 && (
                  <>
                    <div className="flex gap-3 text-sm">
                      <span>Total: <strong>{stats.total}</strong></span>
                      <span className="text-green-600">Approved: <strong>{stats.approved}</strong></span>
                      <span className="text-red-600">Rejected: <strong>{stats.rejected}</strong></span>
                      <span className="text-yellow-600">Pending: <strong>{stats.pending}</strong></span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {salons.length > 0 && (
              <button
                onClick={exportData}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              >
                Export JSON
              </button>
            )}
          </div>
        </div>

        {salons.length > 0 && (
          <>
            {viewMode === 'individual' && currentSalon && (
              <>
                {/* Navigation Bar with Controls */}
                <div className="bg-white rounded-lg shadow-sm px-4 py-2.5 mb-4">
                  <div className="flex items-center justify-between">
                    {/* Previous Button */}
                    <button
                      onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                      disabled={currentIndex === 0}
                      className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
                    >
                      ← Previous
                    </button>
                    
                    {/* Center Section - View Toggle and Progress */}
                    <div className="flex flex-col items-center gap-2">
                      {/* View Toggle */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => setViewMode('individual')}
                          title="Individual Review"
                          className={`p-1.5 rounded-md ${viewMode === 'individual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          title="List View"
                          className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Progress Info */}
                      <div className="flex items-center gap-3 text-sm">
                        <span>
                          Reviewing salon <strong>{currentIndex + 1}</strong> of <strong>{salons.length}</strong>
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                          salonStatuses[currentIndex] === 'approved' ? 'bg-green-100 text-green-800' :
                          salonStatuses[currentIndex] === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {(salonStatuses[currentIndex] || 'pending').toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">{Math.round(((currentIndex + 1) / salons.length) * 100)}%</span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-64 bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${((currentIndex + 1) / salons.length) * 100}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Next Button */}
                    <button
                      onClick={() => setCurrentIndex(Math.min(salons.length - 1, currentIndex + 1))}
                      disabled={currentIndex === salons.length - 1}
                      className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
                    >
                      Next →
                    </button>
                  </div>
                </div>

                {/* Image Gallery */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-base font-semibold">
                      Salon Images ({vercelThumbnails.length})
                    </h3>
                    <div className="flex gap-2">
                      <input
                        ref={imageFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => imageFileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {uploadingImage ? 'Uploading...' : 'Add Image'}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {vercelThumbnails.length === 0 ? (
                      <div className="w-full text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                        No images available
                      </div>
                    ) : (
                      vercelThumbnails.map((url: string, idx: number) => (
                        <div key={idx} className="relative flex-shrink-0">
                          <img
                            src={url}
                            alt={`Image ${idx + 1}`}
                            className="w-48 h-36 object-cover rounded-lg"
                          />
                          <span className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                            {idx + 1}
                          </span>
                          <button
                            onClick={() => handleDeleteImage(url)}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded hover:bg-red-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Editor Form */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-16">
                  <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-4">
                    {/* Basic Information */}
                    <div className="mb-4">
                      <h3 className="text-base font-semibold mb-3">Basic Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium mb-0.5">Salon Name *</label>
                          <input
                            type="text"
                            value={currentSalon.name || ''}
                            onChange={(e) => updateSalonField('name', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border rounded-md"
                            required
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium mb-0.5">Address *</label>
                          <input
                            type="text"
                            value={currentSalon.address || ''}
                            onChange={(e) => updateSalonField('address', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border rounded-md"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-0.5">Latitude *</label>
                          <input
                            type="number"
                            value={currentSalon.coordinates?.latitude || ''}
                            onChange={(e) => updateSalonField('coordinates.latitude', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border rounded-md"
                            step="any"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-0.5">Longitude *</label>
                          <input
                            type="number"
                            value={currentSalon.coordinates?.longitude || ''}
                            onChange={(e) => updateSalonField('coordinates.longitude', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border rounded-md"
                            step="any"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Service Categories */}
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-4">Service Categories</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-lg">
                        {VALID_SERVICE_CATEGORIES.map(category => (
                          <label key={category} className="flex items-center gap-2 p-2 bg-white rounded hover:bg-blue-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentSalon.serviceCategories?.includes(category) || false}
                              onChange={(e) => {
                                const categories = currentSalon.serviceCategories || [];
                                if (e.target.checked) {
                                  updateSalonField('serviceCategories', [...categories, category]);
                                } else {
                                  updateSalonField('serviceCategories', categories.filter((c: string) => c !== category));
                                }
                              }}
                              className="text-blue-600"
                            />
                            <span className="text-sm">{category}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="mb-4">
                      <h3 className="text-base font-semibold mb-3">Contact Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-0.5">Phone Number</label>
                          <input
                            type="tel"
                            value={currentSalon.contactNumber || ''}
                            onChange={(e) => updateSalonField('contactNumber', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-0.5">Email</label>
                          <input
                            type="email"
                            value={currentSalon.contactEmail || ''}
                            onChange={(e) => updateSalonField('contactEmail', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border rounded-md"
                          />
                        </div>
                        <div className="relative">
                          <label className="block text-xs font-medium mb-0.5">Website</label>
                          <input
                            type="url"
                            value={currentSalon.website || ''}
                            onChange={(e) => updateSalonField('website', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border rounded-md pr-16"
                          />
                          {currentSalon.website && (
                            <button
                              onClick={() => window.open(currentSalon.website.startsWith('http') ? currentSalon.website : `https://${currentSalon.website}`, '_blank')}
                              className="absolute right-1 bottom-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              Open
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <label className="block text-xs font-medium mb-0.5">Booking Link</label>
                          <input
                            type="url"
                            value={currentSalon.bookingLink || ''}
                            onChange={(e) => updateSalonField('bookingLink', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border rounded-md pr-16"
                          />
                          {currentSalon.bookingLink && (
                            <button
                              onClick={() => window.open(currentSalon.bookingLink.startsWith('http') ? currentSalon.bookingLink : `https://${currentSalon.bookingLink}`, '_blank')}
                              className="absolute right-1 bottom-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              Open
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-4">Rating</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium mb-0.5">Rating Stars (0-5)</label>
                          <input
                            type="number"
                            value={currentSalon.rating?.stars || ''}
                            onChange={(e) => updateSalonField('rating.stars', parseFloat(e.target.value))}
                            className="w-full px-2 py-1.5 text-sm border rounded-md"
                            min="0"
                            max="5"
                            step="0.1"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-0.5">Number of Reviewers</label>
                          <input
                            type="number"
                            value={currentSalon.rating?.numberOfReviewers || ''}
                            onChange={(e) => updateSalonField('rating.numberOfReviewers', parseInt(e.target.value))}
                            className="w-full px-2 py-1.5 text-sm border rounded-md"
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Location Card with Google Static Map */}
                  <LocationCard salon={currentSalon} />
                </div>

                {/* Action Buttons */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
                  <div className="max-w-7xl mx-auto flex justify-center gap-4">
                    <button
                      onClick={() => updateStatus('approved')}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => updateStatus('rejected')}
                      className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      ✗ Reject
                    </button>
                    <button
                      onClick={() => updateStatus('pending')}
                      className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      → Skip
                    </button>
                  </div>
                </div>
              </>
            )}

            {viewMode === 'list' && (
              <>
                {/* View Toggle for List Mode */}
                <div className="bg-white rounded-lg shadow-sm px-4 py-2.5 mb-4">
                  <div className="flex items-center justify-center">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setViewMode('individual')}
                        title="Individual Review"
                        className={`p-1.5 rounded-md ${viewMode === 'individual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        title="List View"
                        className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold mb-4">All Salons</h2>
                <div className="space-y-2">
                  {salons.map((salon, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        setCurrentIndex(index);
                        setViewMode('individual');
                      }}
                      className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <div>
                        <div className="font-medium">{salon.name || 'Unnamed Salon'}</div>
                        <div className="text-sm text-gray-600">{salon.address || 'No address'}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        salonStatuses[index] === 'approved' ? 'bg-green-100 text-green-800' :
                        salonStatuses[index] === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {(salonStatuses[index] || 'pending').toUpperCase()}
                      </span>
                    </div>
                  ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}