// Handle file selection (for displaying image preview and file name)
document.getElementById('plantImage').addEventListener('change', function(event) {
    const fileInput = event.target;
    const fileNameDisplay = document.querySelector('.custom-file-upload');
    const imagePreview = document.getElementById('image-preview');

    if (fileInput.files && fileInput.files[0]) {
        // Show the selected file name
        const fileName = fileInput.files[0].name;
        fileNameDisplay.textContent = fileName;

        // Display image preview
        const reader = new FileReader();
        reader.onload = function (e) {
            imagePreview.innerHTML = `
                <h3>Image Preview</h3>
                <img src="${e.target.result}" alt="Plant Image" class="image-square">
            `;
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        // Reset to default if no file is selected
        fileNameDisplay.textContent = 'Choose an Image';
        imagePreview.innerHTML = '<h3>Image Preview</h3>';
    }
});

// Handle form submission (for plant identification)
document.getElementById('uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData();
    const fileInput = document.getElementById('plantImage');
    const loader = document.getElementById('loader');
    const resultDiv = document.getElementById('result');
    const knowMoreBtn = document.getElementById('knowMoreBtn');
    const moreInfoDiv = document.getElementById('more-info');
    const mapDiv = document.getElementById('map');

    if (!fileInput.files || fileInput.files.length === 0) {
        resultDiv.innerHTML = '<p>Please select an image first.</p>';
        return;
    }

    // Show loader while processing
    loader.style.display = 'block';
    resultDiv.innerHTML = '';  // Clear the result display
    knowMoreBtn.style.display = 'none';  // Hide the button initially
    moreInfoDiv.innerHTML = '';  // Clear the additional info
    mapDiv.style.display = 'none';  // Hide the map

    // Append the image to the form data
    formData.append('plantImage', fileInput.files[0]);

    try {
        // Send image to the server
        const response = await fetch('https://plantbase-production.up.railway.app/upload', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();
        
        // Hide loader after processing
        loader.style.display = 'none';

        // Display result to the UI
        if (result.error) {
            resultDiv.innerHTML = `<p>${result.error}</p>`;
        } else {
            resultDiv.innerHTML = `
                <h2>Plant Identified</h2>
                <p><strong>Name:</strong> ${result.name}</p>
                <p><strong>Family:</strong> ${result.family}</p>
                <p><strong>Genus:</strong> ${result.genus}</p>
                <p><strong>Common Names:</strong> ${result.commonNames}</p>
            `;

            // Show the "Know More" button
            knowMoreBtn.style.display = 'block';

            // Add event listener to the "Know More" button
            knowMoreBtn.addEventListener('click', async () => {
                moreInfoDiv.innerHTML = "Loading more details...";
                moreInfoDiv.style.display = 'block';
                mapDiv.style.display = 'block';
                mapDiv.innerHTML = ''; // Clear previous map if any

                try {
                    // Make an API call to get more info (Wikipedia API)
                    const moreInfoResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(result.name)}`);
                    const moreInfo = await moreInfoResponse.json();

                    // Display additional info in the UI
                    moreInfoDiv.innerHTML = `
                        <h3>${moreInfo.title}</h3>
                        <p>${moreInfo.extract}</p>
                        <a href="${moreInfo.content_urls.desktop.page}" target="_blank">Read more on Wikipedia</a>
                    `;

                    // Fetch and display distribution data
                    await fetchAndDisplayDistribution(result.name);
                } catch (error) {
                    console.error('Error fetching additional information:', error);
                    moreInfoDiv.innerHTML = "Failed to load additional information.";
                    mapDiv.style.display = 'none';
                }
            });
        }
    } catch (error) {
        console.error('Error during plant identification:', error);
        loader.style.display = 'none';
        resultDiv.innerHTML = '<p>An error occurred while processing your request. Please try again.</p>';
    }
});

async function fetchAndDisplayDistribution(plantName) {
    try {
        const response = await fetch(`https://plantbase-production.up.railway.app/api/plant-distribution/${encodeURIComponent(plantName)}`);
        const distributionData = await response.json();

        if (distributionData.error) {
            throw new Error(distributionData.error);
        }

        if (distributionData.length === 0) {
            document.getElementById('map').innerHTML = 'No distribution data available for this plant.';
            return;
        }

        // Initialize the map
        const map = L.map('map').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Add individual markers for each point
        distributionData.forEach(point => {
            L.marker([point.lat, point.lng]).addTo(map);
        });

        // Fit the map to the bounds of the data points
        const bounds = L.latLngBounds(distributionData.map(point => [point.lat, point.lng]));
        map.fitBounds(bounds);

    } catch (error) {
        console.error('Error fetching distribution data:', error);
        document.getElementById('map').innerHTML = 'Failed to load distribution map.';
    }
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Handle contact form submission
document.getElementById('contactForm').addEventListener('submit', function(event) {
    event.preventDefault();
    // Here you would typically send the form data to a server
    // For now, we'll just log it to the console
    console.log('Form submitted:', {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        message: document.getElementById('message').value
    });
    alert('Thank you for your message! We will get back to you soon.');
    this.reset();
});

// ... (rest of the JavaScript code remains unchanged) ...
