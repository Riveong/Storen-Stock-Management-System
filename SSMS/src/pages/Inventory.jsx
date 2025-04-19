import { useState, useEffect, Fragment, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Dialog, Transition } from '@headlessui/react';
import { v4 as uuidv4 } from 'uuid';

// Add a formatter function for Indonesian Rupiah
const formatRupiah = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

const MAX_FILE_SIZE = 100 * 1024; // 100KB
const SUPPORTED_FORMATS = ['image/jpg', 'image/jpeg', 'image/gif', 'image/png'];

const InventoryPage = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  
  // State for zoom modal
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  
  // File input references
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  
  const [newItem, setNewItem] = useState({ 
    name: '', 
    category_id: '', 
    quantity: 0, 
    price: 0, 
    threshold: 10,
    warehouse_id: '',
    thumbnail: '',
    file: null
  });
  
  // State for edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // State for delete confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  
  // State for category/warehouse management
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  
  const [isNewWarehouseModalOpen, setIsNewWarehouseModalOpen] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState('');
  
  const [error, setError] = useState(null);

  // Fetch inventory items and reference data on component mount
  useEffect(() => {
    const loadData = async () => {
      await fetchCategories();
      await fetchWarehouses();
      await fetchInventory();
    };
    
    loadData();
  }, [currentPage, searchTerm, filterCategory, filterWarehouse]);

  // Fetch inventory items with pagination and filtering
  const fetchInventory = async () => {
    try {
      setLoading(true);
      
      // Build the query
      let query = supabase
        .from('stock')
        .select('*', { count: 'exact' });
        
      // Apply search filters
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }
      
      if (filterCategory) {
        query = query.eq('category', filterCategory);
      }
      
      if (filterWarehouse) {
        query = query.eq('warehouse', filterWarehouse);
      }
      
      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      const { data: stockData, error: stockError, count } = await query
        .order('name')
        .range(from, to);

      if (stockError) throw stockError;
      
      setTotalItems(count || 0);
      
      if (stockData) {
        // For each stock item, attach the category and warehouse objects
        const enhancedStockData = stockData.map(item => {
          // Find the category object based on the category name
          const category = item.category ? 
            categories.find(c => c.name === item.category) || 
            { id: null, name: item.category } : null;
            
          // Find the warehouse object based on the warehouse name
          const warehouse = item.warehouse ?
            warehouses.find(w => w.name === item.warehouse) ||
            { id: null, name: item.warehouse } : null;
            
          return {
            ...item,
            category: category,
            warehouse: warehouse,
            // Set these IDs for form handling
            category_id: category?.id || '',
            warehouse_id: warehouse?.id || ''
          };
        });
        
        setItems(enhancedStockData);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error.message);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get categories from Supabase
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('category')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error.message);
      setError(error.message);
    }
  };

  // Get warehouses from Supabase
  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse')
        .select('*')
        .order('name');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error.message);
      setError(error.message);
    }
  };
  
  // Image optimization function
  const optimizeImage = async (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calculate new dimensions while maintaining aspect ratio
            let width = img.width;
            let height = img.height;
            const aspectRatio = width / height;
            
            // Reduce dimensions until file size is likely below 100KB
            const maxDimension = Math.sqrt((MAX_FILE_SIZE * 8) / 3) * 0.9; // Conservative estimate
            
            if (width > height) {
              width = maxDimension;
              height = width / aspectRatio;
            } else {
              height = maxDimension;
              width = height * aspectRatio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw resized image to canvas
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to JPEG with reduced quality
            canvas.toBlob((blob) => {
              if (blob) {
                // Create a new File from the blob
                const optimizedFile = new File([blob], file.name, { 
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(optimizedFile);
              } else {
                reject(new Error('Failed to optimize image'));
              }
            }, 'image/jpeg', 0.75); // Reduced quality for smaller file size
          };
        };
      } else {
        // If file is already small enough, return as is
        resolve(file);
      }
    });
  };
  
  // Function to handle file selection
  const handleFileChange = async (e, isEdit = false) => {
    try {
      const file = e.target.files[0];
      
      if (!file) return;
      
      // Validate file type
      if (!SUPPORTED_FORMATS.includes(file.type)) {
        throw new Error('Unsupported file format. Please upload a JPG, JPEG, PNG, or GIF.');
      }
      
      // Optimize the image
      const optimizedFile = await optimizeImage(file);
      
      if (isEdit) {
        setEditingItem({
          ...editingItem,
          file: optimizedFile
        });
      } else {
        setNewItem({
          ...newItem,
          file: optimizedFile
        });
      }
    } catch (error) {
      setError(error.message);
    }
  };
  
  // Function to upload image to Supabase Storage
  const uploadImage = async (file) => {
    if (!file) return null;
    
    try {
      setUploading(true);
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase
        .storage
        .from('stock')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
        
      if (error) throw error;
      
      // Get public URL
      const { data: publicUrlData } = supabase
        .storage
        .from('stock')
        .getPublicUrl(filePath);
      
      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error.message);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  // Add new item to inventory
  const addItem = async (e) => {
    e.preventDefault();
    
    try {
      let thumbnailUrl = newItem.thumbnail;
      
      // Upload file if it exists
      if (newItem.file) {
        thumbnailUrl = await uploadImage(newItem.file);
      }
      
      const insertData = { 
        name: newItem.name, 
        quantity: newItem.quantity, 
        price: newItem.price,
        threshold: newItem.threshold,
        thumbnail: thumbnailUrl
      };
      
      // Store category and warehouse as text fields
      if (newItem.category_id) {
        const selectedCategory = categories.find(c => c.id === parseInt(newItem.category_id));
        if (selectedCategory) {
          insertData.category = selectedCategory.name;
        }
      }
      
      if (newItem.warehouse_id) {
        const selectedWarehouse = warehouses.find(w => w.id === parseInt(newItem.warehouse_id));
        if (selectedWarehouse) {
          insertData.warehouse = selectedWarehouse.name;
        }
      }
      
      const { data, error } = await supabase
        .from('stock')
        .insert([insertData])
        .select();

      if (error) throw error;
      
      await fetchInventory();
      
      setNewItem({ 
        name: '', 
        category_id: '', 
        quantity: 0, 
        price: 0, 
        threshold: 10,
        warehouse_id: '',
        thumbnail: '',
        file: null
      });
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Error adding item:', error.message);
      setError(error.message);
    }
  };

  // Handle input changes for new item form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewItem({
      ...newItem,
      [name]: name === 'quantity' || name === 'price' || name === 'threshold' 
        ? parseFloat(value) || 0 
        : value
    });
  };

  // Open edit modal with item data
  const openEditModal = (item) => {
    setEditingItem({
      id: item.id,
      name: item.name,
      category_id: item.category_id,
      quantity: item.quantity,
      price: item.price,
      threshold: item.threshold,
      warehouse_id: item.warehouse_id,
      thumbnail: item.thumbnail,
      file: null
    });
    setIsEditModalOpen(true);
  };

  // Handle edit item changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditingItem({
      ...editingItem,
      [name]: name === 'quantity' || name === 'price' || name === 'threshold' 
        ? parseFloat(value) || 0 
        : value
    });
  };

  // Save edited item
  const saveEditedItem = async () => {
    try {
      console.log("Updating item with data:", editingItem);
      
      let thumbnailUrl = editingItem.thumbnail;
      
      // Upload new file if it exists
      if (editingItem.file) {
        thumbnailUrl = await uploadImage(editingItem.file);
      }
      
      // Create an update object with fields that definitely exist in the table
      const updateData = { 
        name: editingItem.name,
        quantity: editingItem.quantity,
        price: editingItem.price,
        threshold: editingItem.threshold,
        thumbnail: thumbnailUrl
      };
      
      // Check if category and warehouse are stored as text fields or IDs
      if (editingItem.category_id) {
        const selectedCategory = categories.find(c => c.id === parseInt(editingItem.category_id));
        if (selectedCategory) {
          updateData.category = selectedCategory.name;
        }
      }
      
      if (editingItem.warehouse_id) {
        const selectedWarehouse = warehouses.find(w => w.id === parseInt(editingItem.warehouse_id));
        if (selectedWarehouse) {
          updateData.warehouse = selectedWarehouse.name;
        }
      }
      
      console.log("Sending update with data:", updateData);
      
      const { error } = await supabase
        .from('stock')
        .update(updateData)
        .eq('id', editingItem.id);

      if (error) throw error;
      
      // Refresh inventory data
      await fetchInventory();
      setIsEditModalOpen(false);
      
    } catch (error) {
      console.error('Error updating item:', error.message);
      setError(error.message);
    }
  };

  // Open image zoom modal
  const openImageModal = (imageUrl, itemName) => {
    setCurrentImage({ url: imageUrl, name: itemName });
    setIsImageModalOpen(true);
  };

  // Open delete confirmation modal
  const openDeleteModal = (item) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  // Delete item after confirmation
  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('stock')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;
      
      await fetchInventory();
      setIsDeleteModalOpen(false);
      
    } catch (error) {
      console.error('Error deleting item:', error.message);
      setError(error.message);
    }
  };

  // Add new category
  const addCategory = async (e) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('category')
        .insert([{ name: newCategory }])
        .select();

      if (error) throw error;
      
      setCategories([...categories, ...data]);
      setNewCategory('');
      setIsNewCategoryModalOpen(false);
      
    } catch (error) {
      console.error('Error adding category:', error.message);
      setError(error.message);
    }
  };

  // Add new warehouse
  const addWarehouse = async (e) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('warehouse')
        .insert([{ name: newWarehouse }])
        .select();

      if (error) throw error;
      
      setWarehouses([...warehouses, ...data]);
      setNewWarehouse('');
      setIsNewWarehouseModalOpen(false);
      
    } catch (error) {
      console.error('Error adding warehouse:', error.message);
      setError(error.message);
    }
  };

  // Handle pagination
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  const changePage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  // Delayed search to prevent too many requests
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      fetchInventory();
    }, 500);
    
    return () => clearTimeout(delaySearch);
  }, [searchTerm, filterCategory, filterWarehouse]);

  // Get placeholder image for items without thumbnails
  const getPlaceholderImage = (item) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random&color=fff&size=128`;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Inventory Management</h2>
      
      {/* Error display */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
          <p>{error}</p>
          <button className="ml-2 text-sm" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      
      {/* Search and filters */}
      <div className="mb-6 p-4 bg-gray-50 rounded-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Items</label>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Category</label>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.name}>{category.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Warehouse</label>
            <select
              value={filterWarehouse}
              onChange={(e) => {
                setFilterWarehouse(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Warehouses</option>
              {warehouses.map(warehouse => (
                <option key={warehouse.id} value={warehouse.name}>{warehouse.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Add new item form */}
      <div className="mb-6 p-4 bg-gray-50 rounded-md">
        <h3 className="text-lg font-medium mb-2">Add New Item</h3>
        <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              name="name"
              value={newItem.name}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <select
                name="category_id"
                value={newItem.category_id}
                onChange={handleInputChange}
                className="block w-full rounded-l-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Select Category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsNewCategoryModalOpen(true)}
                className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-md hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Quantity</label>
            <input
              type="number"
              name="quantity"
              value={newItem.quantity}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Price</label>
            <input
              type="number"
              name="price"
              step="0.01"
              value={newItem.price}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Threshold</label>
            <input
              type="number"
              name="threshold"
              value={newItem.threshold}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Warehouse</label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <select
                name="warehouse_id"
                value={newItem.warehouse_id}
                onChange={handleInputChange}
                className="block w-full rounded-l-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Select Warehouse</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsNewWarehouseModalOpen(true)}
                className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-md hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>
          
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Thumbnail</label>
            <div className="mt-1 flex items-center space-x-4">
              <input
                type="text"
                name="thumbnail"
                value={newItem.thumbnail}
                onChange={handleInputChange}
                placeholder="https://example.com/image.jpg"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <span className="text-gray-500">OR</span>
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileChange(e, false)}
                  accept="image/jpeg,image/png,image/gif"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-1 text-xs text-gray-500">Max size: 100KB. Larger images will be resized.</p>
              </div>
            </div>
            {newItem.file && (
              <div className="mt-2 flex items-center">
                <div className="h-16 w-16 overflow-hidden rounded-md mr-2">
                  <img 
                    src={URL.createObjectURL(newItem.file)}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="text-sm text-gray-500">
                  Selected: {newItem.file.name} ({Math.round(newItem.file.size / 1024)} KB)
                </div>
              </div>
            )}
          </div>
          
          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Inventory table */}
      <div className="overflow-x-auto">
        {loading ? (
          <p className="text-center py-4">Loading inventory...</p>
        ) : items.length === 0 ? (
          <p className="text-center py-4">No inventory items found. Add your first item above.</p>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warehouse</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div 
                          className="flex-shrink-0 h-10 w-10 mr-2 cursor-pointer"
                          onClick={() => openImageModal(item.thumbnail || getPlaceholderImage(item), item.name)}
                        >
                          <img 
                            className="h-10 w-10 rounded-full object-cover" 
                            src={item.thumbnail || getPlaceholderImage(item)} 
                            alt={item.name}
                            onError={(e) => { e.target.src = getPlaceholderImage(item) }}
                          />
                        </div>
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.category?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatRupiah(item.price || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatRupiah((item.quantity || 0) * (item.price || 0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.quantity <= item.threshold ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.warehouse?.name || 'Main'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(item)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteModal(item)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => changePage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => changePage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{items.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-medium">{totalItems}</span> results
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => changePage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                    >
                      <span className="sr-only">Previous</span>
                      &lt;
                    </button>
                    
                    {/* Page numbers */}
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      // Show pages around current page
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => changePage(pageNumber)}
                          className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                            currentPage === pageNumber 
                              ? 'bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600' 
                              : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => changePage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                    >
                      <span className="sr-only">Next</span>
                      &gt;
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Edit Item Modal */}
      <Transition appear show={isEditModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setIsEditModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Edit Item
                  </Dialog.Title>
                  
                  {editingItem && (
                    <div className="mt-4">
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <input
                          type="text"
                          name="name"
                          value={editingItem.name}
                          onChange={handleEditChange}
                          required
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Category</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <select
                            name="category_id"
                            value={editingItem.category_id || ''}
                            onChange={handleEditChange}
                            className="block w-full rounded-l-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          >
                            <option value="">Select Category</option>
                            {categories.map(category => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setIsNewCategoryModalOpen(true)}
                            className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-md hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700">Quantity</label>
                          <input
                            type="number"
                            name="quantity"
                            value={editingItem.quantity}
                            onChange={handleEditChange}
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700">Price</label>
                          <input
                            type="number"
                            name="price"
                            step="0.01"
                            value={editingItem.price}
                            onChange={handleEditChange}
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700">Threshold</label>
                          <input
                            type="number"
                            name="threshold"
                            value={editingItem.threshold}
                            onChange={handleEditChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700">Warehouse</label>
                          <div className="mt-1 flex rounded-md shadow-sm">
                            <select
                              name="warehouse_id"
                              value={editingItem.warehouse_id || ''}
                              onChange={handleEditChange}
                              className="block w-full rounded-l-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            >
                              <option value="">Select Warehouse</option>
                              {warehouses.map(warehouse => (
                                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setIsNewWarehouseModalOpen(true)}
                              className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-md hover:bg-gray-100"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Thumbnail</label>
                        <div className="mt-1 flex items-center space-x-4">
                          <input
                            type="text"
                            name="thumbnail"
                            value={editingItem.thumbnail}
                            onChange={handleEditChange}
                            placeholder="https://example.com/image.jpg"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                          <span className="text-gray-500">OR</span>
                          <div>
                            <input
                              type="file"
                              ref={editFileInputRef}
                              onChange={(e) => handleFileChange(e, true)}
                              accept="image/jpeg,image/png,image/gif"
                              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            <p className="mt-1 text-xs text-gray-500">Max size: 100KB. Larger images will be resized.</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-4 flex justify-center">
                        {editingItem.file ? (
                          <div className="mt-2">
                            <img 
                              src={URL.createObjectURL(editingItem.file)}
                              alt={editingItem.name}
                              className="h-32 w-32 rounded-md object-cover"
                            />
                            <p className="text-sm text-gray-500 text-center mt-1">
                              New image: {editingItem.file.name} ({Math.round(editingItem.file.size / 1024)} KB)
                            </p>
                          </div>
                        ) : editingItem.thumbnail ? (
                          <img 
                            src={editingItem.thumbnail}
                            alt={editingItem.name}
                            className="h-32 w-32 rounded-md object-cover"
                            onError={(e) => { e.target.src = getPlaceholderImage(editingItem) }}
                          />
                        ) : (
                          <img 
                            src={getPlaceholderImage(editingItem)}
                            alt={editingItem.name}
                            className="h-32 w-32 rounded-md object-cover"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={() => setIsEditModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={uploading}
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      onClick={saveEditedItem}
                    >
                      {uploading ? 'Uploading...' : 'Save Changes'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      
      {/* Image Zoom Modal */}
      <Transition appear show={isImageModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-20" onClose={() => setIsImageModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-75" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-transparent text-left align-middle shadow-xl transition-all">
                  <div className="relative">
                    <button 
                      onClick={() => setIsImageModalOpen(false)}
                      className="absolute top-2 right-2 bg-white text-gray-800 rounded-full p-2 hover:bg-gray-200"
                    >
                      ✕
                    </button>
                    
                    {currentImage && (
                      <>
                        <img 
                          src={currentImage.url} 
                          alt={currentImage.name}
                          className="max-h-[80vh] mx-auto rounded-lg"
                          onError={(e) => { 
                            e.target.src = currentImage.name ? 
                              getPlaceholderImage({name: currentImage.name}) : 
                              'https://via.placeholder.com/400?text=Image+Not+Found'
                          }}
                        />
                        <div className="bg-white bg-opacity-80 p-2 rounded-b-lg text-center">
                          <h3 className="font-medium">{currentImage.name}</h3>
                        </div>
                      </>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      
      {/* Delete Confirmation Modal */}
      <Transition appear show={isDeleteModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setIsDeleteModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Confirm Deletion
                  </Dialog.Title>
                  
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete <strong>{itemToDelete?.name}</strong>? 
                      This action cannot be undone.
                    </p>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={() => setIsDeleteModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      onClick={confirmDelete}
                    >
                      Delete
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* New Category Modal */}
      <Transition appear show={isNewCategoryModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setIsNewCategoryModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Add New Category
                  </Dialog.Title>
                  
                  <form onSubmit={addCategory}>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700">Category Name</label>
                      <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={() => setIsNewCategoryModalOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Add Category
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* New Warehouse Modal */}
      <Transition appear show={isNewWarehouseModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setIsNewWarehouseModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Add New Warehouse
                  </Dialog.Title>
                  
                  <form onSubmit={addWarehouse}>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700">Warehouse Name</label>
                      <input
                        type="text"
                        value={newWarehouse}
                        onChange={(e) => setNewWarehouse(e.target.value)}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={() => setIsNewWarehouseModalOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Add Warehouse
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      
    </div>
  );
};

export default InventoryPage;