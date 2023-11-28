document.addEventListener('DOMContentLoaded', function () {
    let universitiesData = {};
    let reviewsData = {};

    function initializeApp() {
        fetchCsvData('https://uniview-dynamodb.s3.us-east-2.amazonaws.com/cleaned_items_university_reviews.csv', processUniversityKeywords);
        fetchCsvData('https://uniview-dynamodb.s3.us-east-2.amazonaws.com/updated_interactions_dataset.csv', processUniversityReviews);
    }

    function fetchCsvData(csvUrl, callback) {
        Papa.parse(csvUrl, {
            download: true,
            header: true,
            complete: results => callback(results.data)
        });
    }

    function processUniversityKeywords(data) {
        data.forEach(row => {
            if (!universitiesData[row.ITEM_ID]) {
                universitiesData[row.ITEM_ID] = { keywords: new Set(), reviews: [] };
            }
            row.KEYWORDS?.split(',').forEach(keyword => universitiesData[row.ITEM_ID].keywords.add(keyword.trim()));
        });
        displayUniversityCards();
    }

    function processUniversityReviews(data) {
        reviewsData = data.reduce((acc, row) => {
            if (!acc[row.ITEM_ID]) acc[row.ITEM_ID] = [];
            acc[row.ITEM_ID].push(row);
            return acc;
        }, {});
    }

    function displayUniversityCards() {
        const universityList = document.getElementById('universityList');
        universityList.innerHTML = '';
        Object.keys(universitiesData).forEach(name => {
            const card = document.createElement('div');
            card.className = 'university-card';
            card.textContent = name;
            card.onclick = () => displayUniversityDetails(name);
            universityList.appendChild(card);
        });
    }

    function displayUniversityDetails(name) {
        const details = universitiesData[name];
        getPersonalizeRecommendations(name, details);
    }

    function createModal(name, details, keywords) {
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
                        <h3>Positive Keywords</h3>
                        <ul>${keywords.positive.map(kw => `<li>${kw}</li>`).join('')}</ul>
                        <h3>Negative Keywords</h3>
                        <ul>${keywords.negative.map(kw => `<li>${kw}</li>`).join('')}</ul>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
        createSentimentChart(calculateSentimentCounts(details.reviews), 'sentimentChart');
        modal.style.display = 'block';
    }

    function getPersonalizeRecommendations(universityName, details) {
        fetch('https://za8k6zxf6c.execute-api.us-east-2.amazonaws.com/prod', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: universityName })
        })
            .then(response => response.json())
            .then(data => {
                // Assuming data contains fields like data.positiveKeywords and data.negativeKeywords
                const keywords = {
                    positive: data.positiveKeywords || [],
                    negative: data.negativeKeywords || []
                };
                createModal(universityName, details, keywords);
            })
            .catch(error => console.error('Error:', error));
    }

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
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function calculateSentimentCounts(reviews) {
        return reviews.reduce((counts, review) => {
            counts[review.EVENT_VALUE] = (counts[review.EVENT_VALUE] || 0) + 1;
            return counts;
        }, { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 });
    }

    document.getElementById('searchBar').addEventListener('input', function (e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredNames = Object.keys(universitiesData).filter(name => name.toLowerCase().includes(searchTerm));
        displayUniversityCards(filteredNames);
    });

    initializeApp();
});
