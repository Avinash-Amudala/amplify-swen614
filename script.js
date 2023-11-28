document.addEventListener('DOMContentLoaded', function () {
    let universitiesData = {};
    let reviewsData = {};

    // Initialize the application
    function initializeApp() {
        fetchCsvData('https://uniview-dynamodb.s3.us-east-2.amazonaws.com/cleaned_items_university_reviews.csv', processUniversityKeywords);
        fetchCsvData('https://uniview-dynamodb.s3.us-east-2.amazonaws.com/updated_interactions_dataset.csv', processUniversityReviews);
    }

    // Fetch CSV data from S3
    function fetchCsvData(csvUrl, callback) {
        Papa.parse(csvUrl, {
            download: true,
            header: true,
            complete: function (results) {
                callback(results.data);
            }
        });
    }

    // Process Keywords CSV Data
    function processUniversityKeywords(data) {
        data.forEach(row => {
            if (!universitiesData[row.ITEM_ID]) {
                universitiesData[row.ITEM_ID] = { keywords: new Set(), reviews: [] };
            }
            row.KEYWORDS.split(',').forEach(keyword => {
                universitiesData[row.ITEM_ID].keywords.add(keyword.trim());
            });
        });
        displayUniversityCards(Object.keys(universitiesData));
    }

    // Process Reviews CSV Data
    function processUniversityReviews(data) {
        reviewsData = data.reduce((acc, row) => {
            if (!acc[row.ITEM_ID]) acc[row.ITEM_ID] = [];
            acc[row.ITEM_ID].push(row);
            return acc;
        }, {});
    }

    // Display university cards
    function displayUniversityCards(universities) {
        const universityList = document.getElementById('universityList');
        universityList.innerHTML = '';
        universities.forEach(universityName => {
            const card = document.createElement('div');
            card.className = 'university-card';
            card.textContent = universityName;
            card.addEventListener('click', function () {
                displayUniversityDetails(universityName);
            });
            universityList.appendChild(card);
        });
    }

    // Display university details
    function displayUniversityDetails(universityName) {
        const details = universitiesData[universityName];
        const modal = createModal(universityName, details);
        document.body.appendChild(modal);
        createSentimentChart(calculateSentimentCounts(details.reviews), 'sentimentChart');
    }

    // Create Modal for University Details
    function createModal(universityName, details) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>${universityName}</h2>
                <div class="content-container">
                    <div class="chart-container">
                        <canvas id="sentimentChart"></canvas>
                    </div>
                    <div class="keywords-container">
                        <h3>Keywords</h3>
                        <ul>${Array.from(details.keywords).map(keyword => `<li>${keyword}</li>`).join('')}</ul>
                    </div>
                </div>
            </div>`;
        addModalCloseEvents(modal);
        return modal;
    }

    // Calculate Sentiment Counts
    function calculateSentimentCounts(reviews) {
        const sentimentCounts = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 };
        reviews.forEach(review => {
            sentimentCounts[review.EVENT_VALUE]++;
        });
        return sentimentCounts;
    }

    // Add Close Events to Modal
    function addModalCloseEvents(modal) {
        var span = modal.querySelector(".close");
        span.onclick = function() { modal.style.display = "none"; modal.remove(); };
        window.onclick = function(event) { if (event.target == modal) { modal.style.display = "none"; modal.remove(); } };
    }

    function createSentimentChart(sentimentCounts, canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Positive', 'Negative', 'Neutral', 'Mixed'],
                datasets: [{
                    label: 'Sentiment Analysis',
                    data: [sentimentCounts.POSITIVE, sentimentCounts.NEGATIVE, sentimentCounts.NEUTRAL, sentimentCounts.MIXED],
                    backgroundColor: ['green', 'red', 'blue', 'gray'],
                    borderColor: ['darkgreen', 'darkred', 'darkblue', 'darkgray'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    // Calculate sentiment percentage (optional for tooltips)
    function calculateSentimentPercentage(count, total) {
        return ((count / total) * 100).toFixed(2);
    }

    // Personalize recommendations (optional)
    function getPersonalizeRecommendations(userId) {
        const apiGatewayUrl = 'https://za8k6zxf6c.execute-api.us-east-2.amazonaws.com/prod';
        fetch(apiGatewayUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: userId })
        })
            .then(response => response.json())
            .then(data => {
                console.log('Personalize Recommendations:', data);
                // Process and display recommendations here
            })
            .catch(error => console.error('Error fetching Personalize recommendations:', error));
    }

    // Event listener for the search bar
    document.getElementById('searchBar').addEventListener('input', function (e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredUniversities = Object.keys(universitiesData).filter(universityName =>
            universityName.toLowerCase().includes(searchTerm)
        );
        displayUniversityCards(filteredUniversities);
    });

    // Initialize the application
    initializeApp();
});
