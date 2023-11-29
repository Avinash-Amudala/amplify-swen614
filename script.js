document.addEventListener('DOMContentLoaded', function () {
    let universitiesData = {};
    let userUniversityMatrix = {};
    let sentimentChartInstance = null;
    let currentUser = null;

    function initializeApp() {
        console.log("Initializing application...");
        fetchCsvData('https://uniview-dynamodb.s3.us-east-2.amazonaws.com/interactions.csv', processUniversityData);
        fetchCsvData('https://uniview-dynamodb.s3.us-east-2.amazonaws.com/matrix.csv', processUserUniversityMatrix);
    }

    function fetchCsvData(csvUrl, callback) {
        console.log(`Fetching data from: ${csvUrl}`);
        Papa.parse(csvUrl, {
            download: true,
            header: true,
            complete: results => callback(results.data)
        });
    }

    function processUserUniversityMatrix(data) {
        console.log("Processing user-university matrix...");
        userUniversityMatrix = data.reduce((acc, row) => {
            let userId = row.USER_ID;  // Ensure this matches the actual column name in your CSV
            if (userId) {
                acc[userId] = row;
                delete acc[userId].USER_ID;  // Remove USER_ID to keep only university interactions
            } else {
                console.log("Missing USER_ID in row:", row);  // Log any rows missing USER_ID
            }
            return acc;
        }, {});
        console.log("Processed userUniversityMatrix:", userUniversityMatrix);
    }

    function processUniversityData(data) {
        console.log("Processing university data...");
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
        console.log("Processed universitiesData:", universitiesData);
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
        getRecommendations(currentUser, name);
    }

    function getRecommendations(userId, universityName) {
        console.log(`Getting recommendations for user: ${userId}`);
        let recommendedUniversities = userUniversityMatrix[userId]
            ? calculateRecommendationsForUser(userId)
            : getInitialRecommendations();
        console.log("Recommended Universities:", recommendedUniversities);
        updateRecommendationsList(recommendedUniversities, universityName);
    }
    function getInitialRecommendations() {
        // Logic for initial recommendations for new users
        // We'll recommend the top 5 universities based on overall interactions
        const universityScores = {};
        Object.values(userUniversityMatrix).forEach(user => {
            for (let university in user) {
                universityScores[university] = (universityScores[university] || 0) + user[university];
            }
        });
        return Object.entries(universityScores)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0])
            .slice(0, 5);
    }
    function calculateRecommendationsForUser(userId) {
        console.log(`Calculating recommendations for existing user: ${userId}`);
        // Logic to get recommendations for existing users
        // For simplicity, we'll recommend the top 5 universities based on the user's interaction history
        const userInteractions = userUniversityMatrix[userId];
        const recommendedUniversities = [];
        for (let university in userInteractions) {
            if (userInteractions[university] > 0) {
                recommendedUniversities.push(university);
            }
        }
        return recommendedUniversities.slice(0, 5);
    }

    function getMatrixBasedRecommendations(userId, universityName) {
        const userSimilarities = userSimilarityMatrix[userId] || {};
        const sortedSimilarUsers = Object.entries(userSimilarities)
            .sort((a, b) => b[1] - a[1])
            .slice(1, 6);

        const recommendedUniversities = sortedSimilarUsers.map(([similarUserId, _]) =>
            getPreferredUniversityForUser(similarUserId)).filter(Boolean);

        updateRecommendationsList(recommendedUniversities, universityName);
    }

    function getPreferredUniversityForUser(userId) {
        let topUniversity = '';
        let topScore = -1;

        // Convert the universitiesData object's values to an array and iterate over it
        Object.values(universitiesData).forEach(university => {
            // Assuming each university is an object with a 'reviews' array
            university.reviews.forEach(review => {
                if (review.USER_ID === userId && review.POSITIVE_SCORE > topScore) {
                    topScore = review.POSITIVE_SCORE;
                    topUniversity = review.ITEM_ID;
                }
            });
        });

        return topUniversity;
    }


    function updateRecommendationsList(recommendedUniversities, universityName) {
        console.log(`Updating recommendations list for: ${universityName}`);
        const recommendationsListId = `recommendations-list-${universityName.replace(/\s+/g, '-')}`;
        const recommendationsList = document.getElementById(recommendationsListId);
        if (recommendationsList) {
            if (recommendedUniversities.length > 0) {
                recommendationsList.innerHTML = recommendedUniversities.map(university => `<li>${university}</li>`).join('');
            } else {
                recommendationsList.innerHTML = '<li>No recommendations available</li>';
            }
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
