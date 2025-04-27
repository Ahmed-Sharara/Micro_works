/**
 * API helper functions for the Task Platform
 */

// The URL for the Google Apps Script backend
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyVHYXX0uI6skI_w1j-PWZ24ARwceTfan-eFyijWdmMIB1FcGARy7P8Be4FZacpqOuTDQ/exec';

/**
 * Get current username from URL parameters
 * @returns {string|null} The username or null if not found
 */
function getCurrentUser() {
    return new URLSearchParams(window.location.search).get('user');
}

/**
 * Navigate to a different page while preserving user context
 * @param {string} page - The page to navigate to
 * @param {Object} params - Additional URL parameters to include
 */
function navigate(page, params = {}) {
    const user = getCurrentUser();
    let url = '';

    // Handle cases where page already includes parameters
    if (page.includes('?')) {
        // Extract the base page and existing parameters
        const [basePage, existingParams] = page.split('?');
        url = `${basePage}.html?${existingParams}`;
        
        // Add user parameter if not already included
        if (user && !url.includes('user=')) {
            url += `${url.includes('?') ? '&' : '?'}user=${encodeURIComponent(user)}`;
        }
    } else {
        // Regular case - just add parameters to the page
        url = `${page}.html`;
        
        // Add user parameter
        if (user) {
            url += `?user=${encodeURIComponent(user)}`;
        }
        
        // Add other parameters
        if (Object.keys(params).length > 0) {
            const paramString = Object.entries(params)
                .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                .join('&');
            url += `${url.includes('?') ? '&' : '?'}${paramString}`;
        }
    }
    
    window.location.href = url;
}

/**
 * Log the user out
 */
function logout() {
    window.location.href = 'index.html';
}

/**
 * Make a POST request to the API
 * @param {string} path - The API path
 * @param {Object} params - The parameters to send
 * @returns {Promise<Object>} The response data
 */
async function apiPost(path, params) {
    try {
        // Log what we're sending
        console.log(`Making API POST to ${path} with params:`, params);
        
        // Create a JSON payload with path as a property rather than a URL parameter
        const formData = new URLSearchParams();
        formData.append('path', path);
        
        // Add all other parameters
        for (const [key, value] of Object.entries(params)) {
            formData.append(key, value);
        }
        
        // Make the API call
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        
        // Check if the response is JSON
        const contentType = response.headers.get("content-type");
        let responseData;
        
        if (contentType && contentType.indexOf("application/json") !== -1) {
            responseData = await response.json();
        } else {
            const text = await response.text();
            responseData = { message: text, success: response.ok };
        }
        
        // Log the response
        console.log(`API response from ${path}:`, responseData);
        
        return responseData;
    } catch (error) {
        console.error('API error:', error);
        throw new Error('Connection failed');
    }
}

/**
 * Make a GET request to the API
 * @param {string} path - The API path
 * @param {Object} params - The parameters to send
 * @returns {Promise<Object>} The response data
 */
async function apiGet(path, params = {}) {
    try {
        const url = new URL(WEB_APP_URL);
        url.searchParams.append('path', path);
        
        // Add all params to query string
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
        
        const response = await fetch(url);
        
        // Check if the response is JSON
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            const text = await response.text();
            return { message: text, success: response.ok };
        }
    } catch (error) {
        console.error('API error:', error);
        throw new Error('Connection failed');
    }
}

/**
 * Display an error message in an element
 * @param {string} elementId - The ID of the element to show the error in
 * @param {string} message - The error message
 */
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    } else {
        alert(message);
    }
}

/**
 * Load user's coin balance
 * @param {string} elementId - The ID of the element to display the balance in
 */
async function loadCoins(elementId) {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        // Set "Loading..." text first to indicate processing
        document.getElementById(elementId).textContent = "Loading...";
        
        // Make the API request
        const data = await apiGet('get-coins', { username: user });
        
        if (data.success && data.coins !== undefined) {
            // Check for various invalid formats
            let coinValue = data.coins;
            
            // Handle special cases
            if (coinValue === "#NUM!" || coinValue === "#NUM" || 
                coinValue === "NaN" || coinValue === "#VALUE!" || 
                coinValue === "#ERROR!" || coinValue === "undefined") {
                
                // Set a default value
                document.getElementById(elementId).textContent = "0";
                
                // Try to fix by making another call with a delay
                setTimeout(() => {
                    document.getElementById(elementId).textContent = "Loading...";
                    
                    // Use a different endpoint to try to refresh the data
                    fetch(`${WEB_APP_URL}?path=refresh-coins&username=${encodeURIComponent(user)}`)
                        .then(response => response.json())
                        .then(refreshData => {
                            if (refreshData.success && refreshData.coins !== undefined && 
                                refreshData.coins !== "#NUM!" && refreshData.coins !== "#NUM") {
                                document.getElementById(elementId).textContent = refreshData.coins;
                            } else {
                                document.getElementById(elementId).textContent = "0";
                            }
                        })
                        .catch(error => {
                            console.error('Failed to refresh coin balance:', error);
                            document.getElementById(elementId).textContent = "0";
                        });
                }, 500);
            } else if (isNaN(coinValue) && typeof coinValue === 'string') {
                // Try to extract a number from the string
                const extractedNumber = parseInt(coinValue.replace(/[^0-9]/g, ''));
                if (!isNaN(extractedNumber)) {
                    document.getElementById(elementId).textContent = extractedNumber;
                } else {
                    document.getElementById(elementId).textContent = "0";
                }
            } else {
                // Normal case - just show the coins
                document.getElementById(elementId).textContent = coinValue;
            }
        } else {
            // Failed to get data, set default value
            document.getElementById(elementId).textContent = "0";
        }
    } catch (error) {
        console.error('Failed to load coin balance:', error);
        // Set default on error
        document.getElementById(elementId).textContent = "0";
    }
}
