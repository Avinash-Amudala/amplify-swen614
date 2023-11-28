document.addEventListener('DOMContentLoaded', function () {
    let universitiesData = {};
    let reviewsData = {};

    // Initialize the application
    function initializeApp() {
        fetchCsvData('https://uniview-dynamodb.s3.us-east-2.amazonaws.com/cleaned_items_university_reviews.csv', processUniversityKeywords);
        fetchCsvData('https://uniview-dynamodb.s3.us-east-2.amazonaws.com/updated_interactions_dataset.csv', processUniversityReviews);
        attachSearchEventHandler();
    }

    // Fetch CSV data from S3
    function fetchCsvData(csvUrl, callback) {
        Papa.parse(csvUrl, {
            download: true,
            header: true,
            complete: results => callback(results.data)
        });
    }

    // Process Keywords CSV Data
    function processUniversityKeywords(data) {
        data.forEach(row => {
            if (!universitiesData[row.ITEM_ID]) {
                universitiesData[row.ITEM_ID] = { keywords: new Set(), reviews: [] };
            }
            row.KEYWORDS?.split(',').forEach(keyword => universitiesData[row.ITEM_ID].keywords.add(keyword.trim()));
        });
        displayUniversityCards();
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
    function displayUniversityCards(filteredNames = Object.keys(universitiesData)) {
        const universityList = document.getElementById('universityList');
        universityList.innerHTML = '';
        filteredNames.forEach(name => {
            const card = createUniversityCard(name);
            universityList.appendChild(card);
        });
    }

    function createUniversityCard(name) {
        const card = document.createElement('div');
        card.className = 'university-card';
        card.textContent = name;
        card.onclick = () => displayUniversityDetails(name);
        return card;
    }

    // Display university details
    function displayUniversityDetails(name) {
        const details = universitiesData[name];
        const modal = createModal(name, details);
        document.body.appendChild(modal);
        getPersonalizeRecommendations(name);
    }

    // Create Modal for University Details
    function createModal(name, details) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.parentElement.parentElement.style.display='none'">&times;</span>
                <h2>${name}</h2>
                <div class="content-container">
                    <div class="chart-container">
                        <canvas id="sentimentChart"></canvas>
                    </div>
                    <div class="keywords-container">
                        <h3>Recommended Universities</h3>
                        <ul id="recommended-universities"></ul>
                    </div>
                </div>
            </div>`;
        createSentimentChart(calculateSentimentCounts(details.reviews), 'sentimentChart');
        return modal;
    }

    // Calculate Sentiment Counts
    function calculateSentimentCounts(reviews) {
        return reviews.reduce((counts, review) => {
            counts[review.EVENT_VALUE] = (counts[review.EVENT_VALUE] || 0) + 1;
            return counts;
        }, { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 });
    }

    // Sentiment Chart Creation
    function createSentimentChart(counts, canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Positive', 'Negative', 'Neutral', 'Mixed'],
                datasets: [{
                    label: 'Sentiment Analysis',
                    data: Object.values(counts),
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

    // Personalize recommendations
    function getPersonalizeRecommendations(userId) {
        fetch('https://za8k6zxf6c.execute-api.us-east-2.amazonaws.com/prod', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        })
            .then(response => response.json())
            .then(data => displayPersonalizeRecommendations(data, userId))
            .catch(error => console.error('Error:', error));
    }

    function displayPersonalizeRecommendations(data, universityName) {
        const recommendationList = document.getElementById('recommended-universities');
        recommendationList.innerHTML = data.itemList.map(item => `<li>${item.itemId}</li>`).join('');
    }

    // Search Event Handler
    function attachSearchEventHandler() {
        document.getElementById('searchBar').addEventListener('input', e => {
            const searchTerm = e.target.value.toLowerCase();
            displayUniversityCards(Object.keys(universitiesData).filter(name => name.toLowerCase().includes(searchTerm)));
        });
    }

    initializeApp();
});
