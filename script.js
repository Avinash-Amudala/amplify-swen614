document.addEventListener('DOMContentLoaded', function () {
    let universitiesData = {};
    let userSimilarityMatrix = {};
    let sentimentChartInstance = null; // Global variable to keep track of the chart instance
    let currentUser = null;

    function initializeApp() {
        fetchCsvData('https://uniview-dynamodb.s3.us-east-2.amazonaws.com/interactions.csv', processUniversityData);
        fetchCsvData('https://uniview-dynamodb.s3.us-east-2.amazonaws.com/matrix.csv', processUserSimilarityMatrix);
    }

    function fetchCsvData(csvUrl, callback) {
        Papa.parse(csvUrl, {
            download: true,
            header: true,
            complete: results => callback(results.data)
        });
    }

    function processUserSimilarityMatrix(data) {
        userSimilarityMatrix = data.reduce((acc, row) => {
            acc[row.USER_ID] = row;
            return acc;
        }, {});
    }

    function processUniversityData(data) {
        universitiesData = data.reduce((acc, row) => {
            if (!acc[row.ITEM_ID]) {
                acc[row.ITEM_ID] = {
                    reviews: [],
                    positiveKeywords: new Set(),
                    negativeKeywords: new Set(),
                    sentimentScores: []
                };
            }
            acc[row.ITEM_ID].reviews.push(row);
            row.POSITIVE_KEYWORDS?.split(',').forEach(kw => acc[row.ITEM_ID].positiveKeywords.add(kw.trim()));
            row.NEGATIVE_KEYWORDS?.split(',').forEach(kw => acc[row.ITEM_ID].negativeKeywords.add(kw.trim()));

            acc[row.ITEM_ID].sentimentScores.push({
                positive: parseFloat(row.POSITIVE_SCORE),
                negative: parseFloat(row.NEGATIVE_SCORE),
                neutral: parseFloat(row.NEUTRAL_SCORE)
            });
            return acc;
        }, {});
        displayUniversityCards();
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
    function handleLogin() {
        const username = document.getElementById('usernameInput').value;
        if (username) {
            currentUser = username; // Set the current user
            document.getElementById('loginForm').style.display = 'none'; // Hide login form
            initializeApp(); // Initialize the app after login
        } else {
            alert("Please enter a username.");
        }
    }
    document.getElementById('loginButton').addEventListener('click', handleLogin);

    function displayUniversityDetails(name) {
        if (!currentUser) {
            alert("Please login first.");
            return;
        }
        const details = universitiesData[name];
        createModal(name, details);
        getMatrixBasedRecommendations(currentUser, name); // Use the current user's ID
    }
    function getMatrixBasedRecommendations(userId, universityName) {
        const userSimilarities = userSimilarityMatrix[userId] || {};
        const sortedSimilarUsers = Object.entries(userSimilarities)
            .sort((a, b) => b[1] - a[1])
            .slice(1, 6);

        // Map similar users to their preferred universities
        const recommendedUniversities = sortedSimilarUsers.map(([similarUserId, _]) => getPreferredUniversityForUser(similarUserId)).filter(Boolean);

        // Update recommendations list
        updateRecommendationsList(recommendedUniversities, universityName);
    }
    function getPreferredUniversityForUser(userId) {
        let topUniversity = '';
        let topScore = -1;

        // Iterate over each review and find the top university for the user based on positive score
        universitiesData.forEach(review => {
            if (review.USER_ID === userId && review.POSITIVE_SCORE > topScore) {
                topScore = review.POSITIVE_SCORE;
                topUniversity = review.ITEM_ID;
            }
        });

        return topUniversity;
    }
    function updateRecommendationsList(recommendedUniversities, universityName) {
        const recommendationsListId = `recommendations-list-${universityName.replace(/\s+/g, '-')}`;
        const recommendationsList = document.getElementById(recommendationsListId);
        if (recommendationsList) {
            recommendationsList.innerHTML = recommendedUniversities.map(university => `<li>${university}</li>`).join('');
        }
    }

    function createModal(name, details) {
        // Remove any existing modal
        const existingModal = document.querySelector('.modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Use a sanitized name for the IDs
        const sanitizedModalName = name.replace(/\s+/g, '-');

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
    <div class="modal-content">
        <span class="close" onclick="this.parentElement.parentElement.style.display='none'">&times;</span>
        <h2>${name}</h2>
        <div class="modal-body">
            <div class="chart-container">
                <h3>Sentiment Analysis</h3>
                <canvas id="sentimentChart-${sanitizedModalName}"></canvas>
            </div>
            <div class="keywords-section">
                <div class="keywords-container">
                    <h3>Positive Keywords</h3>
                    <ul>${Array.from(details.positiveKeywords).map(kw => `<li>${kw}</li>`).join('')}</ul>
                </div>
                <div class="keywords-container">
                    <h3>Negative Keywords</h3>
                    <ul>${Array.from(details.negativeKeywords).map(kw => `<li>${kw}</li>`).join('')}</ul>
                </div>
            </div>
            <div class="score-container">
                <h3>Average Sentiment Scores</h3>
                <p><strong>Positive:</strong> ${calculateAverageScore(details.sentimentScores, 'positive')}%</p>
                <p><strong>Negative:</strong> ${calculateAverageScore(details.sentimentScores, 'negative')}%</p>
                <p><strong>Neutral:</strong> ${calculateAverageScore(details.sentimentScores, 'neutral')}%</p>
            </div>
            <div class="personalized-recommendations">
                <h3>Personalized Recommendations</h3>
                <ul id="recommendations-list-${sanitizedModalName}"></ul>
            </div>
        </div>
    </div>`;
        document.body.appendChild(modal);
        createSentimentChart(calculateSentimentCounts(details.reviews), `sentimentChart-${sanitizedModalName}`);
        modal.style.display = 'block';
    }


    function getPersonalizeRecommendations(universityName, details) {
        fetch('https://i978sjfn4d.execute-api.us-east-2.amazonaws.com/prod', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: universityName })
        })
            .then(response => response.json())
            .then(data => {
                const recommendationsList = document.getElementById('recommendations-list');
                recommendationsList.innerHTML = data.recommendations.map(item => `<li>${item}</li>`).join('');
                createModal(universityName, details);
            })
            .catch(error => console.error('Error:', error));
    }

    function createSentimentChart(counts, canvasId) {
        if (sentimentChartInstance) {
            sentimentChartInstance.destroy();
        }

        const ctx = document.getElementById(canvasId).getContext('2d');
        sentimentChartInstance = new Chart(ctx, {
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
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 15,
                        bottom: 15
                    }
                }
            }
        });
    }
    function calculateSentimentCounts(reviews) {
        return reviews.reduce((counts, review) => {
            counts[review.EVENT_VALUE] = (counts[review.EVENT_VALUE] || 0) + 1;
            return counts;
        }, { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 });
    }

    function calculateAverageScore(scores, type) {
        const total = scores.reduce((acc, score) => acc + score[type], 0);
        return (total / scores.length * 100).toFixed(2);
    }

    document.getElementById('searchBar').addEventListener('input', function (e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredNames = Object.keys(universitiesData).filter(name => name.toLowerCase().includes(searchTerm));
        displayUniversityCards(filteredNames);
    });

    initializeApp();
});
