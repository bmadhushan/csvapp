import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

// Consider moving to a separate constants file if it grows
const APP_HEADERS = [
  "ID", "Type", "SKU", "GTIN, UPC, EAN, or ISBN", "Name", "Published",
  "Is featured?", "Visibility in catalog", "Short description", "Description",
  "Date sale price starts", "Date sale price ends", "Tax status", "Tax class",
  "In stock?", "Stock", "Low stock amount", "Backorders allowed?",
  "Sold individually?", "Weight (kg)", "Length (cm)", "Width (cm)",
  "Height (cm)", "Allow customer reviews?", "Purchase note", "Sale price",
  "Regular price", "Categories", "Tags", "Shipping class", "Images",
  "Download limit", "Download expiry days", "Parent", "Grouped products",
  "Upsells", "Cross-sells", "External URL", "Button text", "Position",
  "Brands"
];

function App() {
  const [csvData, setCsvData] = useState([]);
  const [uploadedHeaders, setUploadedHeaders] = useState([]);
  const [headerMap, setHeaderMap] = useState({});
  const [margin, setMargin] = useState(0);
  const [conversionRate, setConversionRate] = useState(1);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [fileName, setFileName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [fileInfo, setFileInfo] = useState({ size: 0, rows: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [exportFormat, setExportFormat] = useState('csv');
  const [customFileName, setCustomFileName] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  // Effect to create initial header mapping when new headers are uploaded
  useEffect(() => {
    if (uploadedHeaders.length > 0) {
      const initialMap = {};
      uploadedHeaders.forEach((header) => {
        // Enhanced auto-mapping with better matching
        const normalizedHeader = header.toLowerCase().trim();
        
        // Try exact match first
        let foundAppHeader = APP_HEADERS.find(appH => appH.toLowerCase() === normalizedHeader);
        
        // If no exact match, try partial matches
        if (!foundAppHeader) {
          foundAppHeader = APP_HEADERS.find(appH => {
            const normalizedAppHeader = appH.toLowerCase();
            return normalizedAppHeader.includes(normalizedHeader) || 
                   normalizedHeader.includes(normalizedAppHeader);
          });
        }
        
        // Special case mappings for common variations
        if (!foundAppHeader) {
          const mappings = {
            'price': 'Regular price',
            'cost': 'Regular price',
            'amount': 'Regular price',
            'title': 'Name',
            'product_name': 'Name',
            'description': 'Description',
            'short_description': 'Short description',
            'category': 'Categories',
            'tag': 'Tags',
            'image': 'Images',
            'stock_quantity': 'Stock',
            'weight': 'Weight (kg)',
            'length': 'Length (cm)',
            'width': 'Width (cm)',
            'height': 'Height (cm)'
          };
          
          foundAppHeader = mappings[normalizedHeader] || "";
        }
        
        initialMap[header] = foundAppHeader || "";
      });
      setHeaderMap(initialMap);
    }
  }, [uploadedHeaders]); // Only run when uploadedHeaders change

  const processFile = (file) => {
    // Reset previous state
    setCsvData([]);
    setUploadedHeaders([]);
    setHeaderMap({});
    setDownloadUrl(null);
    
    if (file && (file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.name.toLowerCase().endsWith('.csv') || file.type === 'text/plain')) {
      setFileName(file.name);
      setFileInfo({ size: (file.size / 1024).toFixed(2), rows: 0 });
      setProcessing(true);
      
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // Keep all values as strings initially
        complete: (results) => {
          console.log("Parse results:", results);
          
          if (results.data && results.data.length > 0 && results.meta && results.meta.fields) {
            // Filter out completely empty rows
            const filteredData = results.data.filter(row => 
              Object.values(row).some(value => value !== null && value !== undefined && value !== '')
            );
            
            if (filteredData.length > 0) {
              setCsvData(filteredData);
              setUploadedHeaders(results.meta.fields);
              setFileInfo(prev => ({ ...prev, rows: filteredData.length }));
            } else {
              alert("CSV file appears to be empty or contains no valid data.");
              resetFileState();
            }
          } else {
            alert("Could not parse CSV or CSV is empty/invalid.");
            resetFileState();
          }
          setProcessing(false);
        },
        error: (error) => {
          console.error("PapaParse Error:", error);
          alert(`Error parsing CSV: ${error.message}`);
          resetFileState();
          setProcessing(false);
        }
      });
    } else {
      alert('Please select a valid CSV file.');
      resetFileState();
    }
  };

  const resetFileState = () => {
    setCsvData([]);
    setUploadedHeaders([]);
    setHeaderMap({});
    setFileName("");
    setFileInfo({ size: 0, rows: 0 });
    setDownloadUrl(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const clearFileInput = () => {
    const fileInput = document.getElementById('csv-upload');
    if (fileInput) {
      fileInput.value = '';
    }
    resetFileState();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only set drag over to false if we're actually leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleMappingChange = (uploadedHeader, appHeader) => {
    console.log('Mapping change:', uploadedHeader, '->', appHeader);
    setHeaderMap((prevMap) => ({ ...prevMap, [uploadedHeader]: appHeader }));
  };

  const generateProcessedData = () => {
    return csvData.map((row) => {
      const newRow = {};
      APP_HEADERS.forEach((appHeader) => {
        const originalKey = Object.keys(headerMap).find(
          (key) => headerMap[key] === appHeader
        );
        let value = originalKey && row[originalKey] !== undefined ? row[originalKey] : "";

        if (appHeader === "Regular price" || appHeader === "Sale price") {
          const price = parseFloat(String(value).replace(/[^0-9.-]+/g, ""));
          if (!isNaN(price)) {
            const adjustedPrice = price * (1 + parseFloat(margin) / 100) * parseFloat(conversionRate);
            value = adjustedPrice.toFixed(2);
          } else {
            value = "";
          }
        }
        
        if (appHeader === "Tags" && selectedTags.length > 0) {
          value = selectedTags.join(', ');
        }
        
        newRow[appHeader] = value;
      });
      return newRow;
    });
  };

  const handleCellEdit = (rowIndex, header, newValue) => {
    const updatedData = [...csvData];
    updatedData[rowIndex][header] = newValue;
    setCsvData(updatedData);
    setEditingCell(null);
  };

  const getSmartSuggestions = (uploadedHeader) => {
    const normalizedUploaded = uploadedHeader.toLowerCase().trim();
    
    // Calculate similarity scores for each app header
    const scoredSuggestions = APP_HEADERS.map(appHeader => {
      const normalizedApp = appHeader.toLowerCase();
      let score = 0;
      
      // Exact match gets highest score
      if (normalizedApp === normalizedUploaded) {
        score = 100;
      }
      // Contains relationship
      else if (normalizedApp.includes(normalizedUploaded) || normalizedUploaded.includes(normalizedApp)) {
        score = 80;
      }
      // Word-by-word matching
      else {
        const uploadedWords = normalizedUploaded.split(/[\s_-]+/);
        const appWords = normalizedApp.split(/[\s_-]+/);
        
        const matchingWords = uploadedWords.filter(word => 
          appWords.some(appWord => appWord.includes(word) || word.includes(appWord))
        );
        
        if (matchingWords.length > 0) {
          score = (matchingWords.length / Math.max(uploadedWords.length, appWords.length)) * 60;
        }
      }
      
      return { header: appHeader, score };
    });
    
    // Filter out very low scores and sort by score
    return scoredSuggestions
      .filter(item => item.score > 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.header);
  };

  const calculateStats = () => {
    if (csvData.length === 0) return { count: 0, priceRange: '', avgProfit: 0 };
    
    const prices = csvData.map(row => {
      const priceKey = Object.keys(headerMap).find(key => headerMap[key] === 'Regular price');
      const price = parseFloat(String(row[priceKey] || 0).replace(/[^0-9.-]+/g, ''));
      return isNaN(price) ? 0 : price;
    }).filter(p => p > 0);
    
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const avgProfit = prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length) * (margin / 100) : 0;
    
    return {
      count: csvData.length,
      priceRange: `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`,
      avgProfit: avgProfit.toFixed(2)
    };
  };

  const addTag = (tag) => {
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const handleDownload = () => {
    if (csvData.length === 0) {
      alert("Please upload a CSV file first.");
      return;
    }
    setProcessing(true);
    // Simulate a bit of processing time for UX, actual processing is fast
    setTimeout(() => {
      const processedData = generateProcessedData();
      if (processedData.length === 0) {
        alert("No data to process or download.");
        setProcessing(false);
        return;
      }
      const csv = Papa.unparse(processedData, { columns: APP_HEADERS });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setProcessing(false);
    }, 500);
  };

  const Section = ({ title, children }) => (
    <div className={`shadow-md rounded-lg p-6 space-y-4 ${
      darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
    }`}>
      {title && <h2 className={`text-xl font-semibold border-b pb-2 mb-4 ${
        darkMode ? 'text-gray-200 border-gray-700' : 'text-gray-700 border-gray-200'
      }`}>{title}</h2>}
      {children}
    </div>
  );

  return (
    <div className={`min-h-screen flex flex-col items-center py-8 px-4 transition-colors ${
      darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
    }`}>
      <div className="w-full max-w-4xl space-y-6">
        <form onSubmit={(e) => e.preventDefault()}>
        <header className="text-center relative">
          <div className="absolute right-0 top-0">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-indigo-600">CSV Product Processor</h1>
          <p className={`mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Upload, map, transform, and download your product data.</p>
        </header>

        <Section title="📤 Upload CSV File">
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="flex flex-col items-center space-y-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <p className="text-lg font-medium text-gray-700">Drop your CSV file here</p>
                <p className="text-sm text-gray-500">or click to browse</p>
              </div>
              <label
                htmlFor="csv-upload"
                className="cursor-pointer bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-2 px-6 rounded-md transition duration-150 ease-in-out"
              >
                {fileName ? "Change File" : "Choose CSV File"}
              </label>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,.txt,text/csv,application/vnd.ms-excel,text/plain"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
          {fileName && (
            <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{fileName}</p>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{fileInfo.rows} rows • {fileInfo.size} KB</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-green-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <button
                    onClick={clearFileInput}
                    className="text-red-500 hover:text-red-700 p-1 rounded"
                    title="Clear file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
          {processing && csvData.length === 0 && (
            <div className="flex items-center justify-center mt-4">
              <svg className="animate-spin h-5 w-5 text-indigo-500 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-sm text-indigo-500">Processing file...</p>
            </div>
          )}
        </Section>

        {csvData.length > 0 && (
          <Section title="📊 Data Preview">
            <div className="mb-4">
              <p className="text-sm text-gray-600">Preview your CSV data (first 10 rows). Click any cell to edit.</p>
            </div>
            <div className="overflow-x-auto max-h-96 border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {uploadedHeaders.slice(0, 6).map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                    {uploadedHeaders.length > 6 && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        +{uploadedHeaders.length - 6} more
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {csvData.slice(0, 10).map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      {uploadedHeaders.slice(0, 6).map((header) => (
                        <td key={`${rowIndex}-${header}`} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {editingCell?.row === rowIndex && editingCell?.header === header ? (
                            <input
                              type="text"
                              defaultValue={row[header]}
                              onBlur={(e) => handleCellEdit(rowIndex, header, e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleCellEdit(rowIndex, header, e.target.value)}
                              className="w-full px-2 py-1 border rounded"
                              autoFocus
                            />
                          ) : (
                            <div 
                              onClick={() => setEditingCell({ row: rowIndex, header })}
                              className="cursor-pointer hover:bg-blue-50 p-1 rounded"
                            >
                              {row[header] || '-'}
                            </div>
                          )}
                        </td>
                      ))}
                      {uploadedHeaders.length > 6 && (
                        <td className="px-4 py-3 text-sm text-gray-400">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvData.length > 10 && (
              <p className="text-sm text-gray-500 mt-2">Showing 10 of {csvData.length} rows</p>
            )}
          </Section>
        )}

        {uploadedHeaders.length > 0 && (
          <Section title="🧩 Header Mapping">
            <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Match your CSV column headers to the application's expected headers.
              Smart suggestions are provided based on similarity.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>Your CSV Header</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>Map to App Header</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>Suggestions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-gray-200 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  {uploadedHeaders.map((uploaded) => {
                    const suggestions = getSmartSuggestions(uploaded);
                    return (
                      <tr key={uploaded}>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}>{uploaded}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <select
                            value={headerMap[uploaded] || ""}
                            onChange={(e) => handleMappingChange(uploaded, e.target.value)}
                            className={`mt-1 block w-full pl-3 pr-10 py-2 text-base focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                          >
                            <option value="">-- Select App Header --</option>
                            {APP_HEADERS.map((appHeader) => (
                              <option key={appHeader} value={appHeader}>{appHeader}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {suggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleMappingChange(uploaded, suggestion);
                                }}
                                className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  darkMode 
                                    ? 'bg-blue-800 text-blue-200 hover:bg-blue-700' 
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                                tabIndex={0}
                              >
                                {suggestion}
                              </button>
                            ))}
                            {suggestions.length === 0 && (
                              <span className={`text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No suggestions</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {csvData.length > 0 && (
          <Section title="💰 Pricing Panel">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <label htmlFor="margin" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Margin (%)
                </label>
                <input
                  id="margin"
                  type="number"
                  value={margin}
                  onChange={(e) => {
                    e.preventDefault();
                    setMargin(parseFloat(e.target.value) || 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                  placeholder="e.g., 10"
                />
              </div>
              <div>
                <label htmlFor="conversionRate" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Currency Conversion Rate
                </label>
                <input
                  id="conversionRate"
                  type="number"
                  step="0.01"
                  value={conversionRate}
                  onChange={(e) => {
                    e.preventDefault();
                    setConversionRate(parseFloat(e.target.value) || 1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                  placeholder="e.g., 1.1"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Live Calculation Example
                </label>
                <div className={`p-3 rounded-md ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span>Original Price:</span>
                      <span>$100.00</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>+ Margin ({margin}%):</span>
                      <span>+${(100 * margin / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                      <span>× Conversion ({conversionRate}):</span>
                      <span>×{conversionRate}</span>
                    </div>
                    <hr className="my-1" />
                    <div className="flex justify-between font-semibold">
                      <span>Final Price:</span>
                      <span>${(100 * (1 + margin / 100) * conversionRate).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>
        )}

        {csvData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Section title="🧠 Export Section">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="exportFormat" className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Export Format
                      </label>
                      <select
                        id="exportFormat"
                        value={exportFormat}
                        onChange={(e) => {
                          e.preventDefault();
                          setExportFormat(e.target.value);
                        }}
                        className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                      >
                        <option value="csv">CSV (.csv)</option>
                        <option value="xlsx">Excel (.xlsx)</option>
                        <option value="json">JSON (.json)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="customFileName" className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Custom Filename (optional)
                      </label>
                      <input
                        id="customFileName"
                        type="text"
                        value={customFileName}
                        onChange={(e) => {
                          e.preventDefault();
                          setCustomFileName(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                        }}
                        className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                        placeholder="e.g., my-products"
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center space-y-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDownload();
                      }}
                      disabled={processing || csvData.length === 0}
                      className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold py-3 px-6 rounded-md transition duration-150 ease-in-out text-lg flex items-center justify-center"
                    >
                      {processing && downloadUrl === null ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : "Download CSV"}
                    </button>

                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        download={customFileName ? `${customFileName}.${exportFormat}` : `updated_products.${exportFormat}`}
                        className="text-indigo-600 hover:text-indigo-800 underline font-medium flex items-center"
                        onClick={() => setTimeout(() => setDownloadUrl(null), 100)}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Your Processed File
                      </a>
                    )}
                  </div>
                </div>
              </Section>
            </div>
            
            <div>
              <Section title="📊 Summary Panel">
                {(() => {
                  const stats = calculateStats();
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <svg className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="ml-4">
                              <p className="text-sm font-medium text-blue-900">Total Products</p>
                              <p className="text-2xl font-bold text-blue-900">{stats.count}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                              </svg>
                            </div>
                            <div className="ml-4">
                              <p className="text-sm font-medium text-green-900">Price Range</p>
                              <p className="text-lg font-bold text-green-900">{stats.priceRange}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-yellow-50 p-4 rounded-lg">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <svg className="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                            </div>
                            <div className="ml-4">
                              <p className="text-sm font-medium text-yellow-900">Avg. Profit</p>
                              <p className="text-lg font-bold text-yellow-900">${stats.avgProfit}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </Section>
            </div>
          </div>
        )}
        
        {csvData.length > 0 && (
          <Section title="🏷 Category & Tags">
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Add Tags (press Enter to add)
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedTags.map((tag, index) => (
                    <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800">
                      {tag}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          removeTag(tag);
                        }}
                        className="ml-2 text-indigo-600 hover:text-indigo-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => {
                    e.preventDefault();
                    setTagInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                  placeholder="Type a tag and press Enter"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Toys'].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        addTag(suggestion);
                      }}
                      className={`px-2 py-1 text-xs rounded transition-colors ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        )}
         
         {csvData.length === 0 && !fileName && (
            <div className={`text-center py-10 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 mx-auto mb-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p>Upload a CSV file to get started.</p>
            </div>
        )}
        </form>
      </div>
      <footer className={`text-center mt-12 py-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        CSV Product Processor Tool - © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default App;