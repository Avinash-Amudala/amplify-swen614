document.addEventListener('DOMContentLoaded', function () {
    let currentUser = localStorage.getItem('currentUser');
    let universitiesData = {};
    let personalizeRecommendations = {};
    let sentimentChartInstance = null;
    let userInteractions = {};

    // Initially show the login modal and blur the app
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('app').style.filter = 'blur(3px)';

    // If the user is already logged in, hide the modal and initialize the app
    if (currentUser) {
        hideLoginModal();
        initializeApp();
    }
    document.getElementById('loginButton').addEventListener('click', attemptLogin);

    function attemptLogin() {
        const username = document.getElementById('usernameInput').value;
        if (username) {
            localStorage.setItem('currentUser', username);
            hideLoginModal();
            initializeApp();
        } else {
            alert("Please enter a username.");
        }
    }
    function hideLoginModal() {
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('app').style.filter = 'none';
    }

    function showLoginModal() {
        document.getElementById('loginModal').style.display = 'flex';
        document.getElementById('app').style.filter = 'blur(3px)';
    }

    document.getElementById('loginButton').addEventListener('click', attemptLogin);

    if (currentUser) {
        document.getElementById('loginModal').style.display = 'none';
        initializeApp();
    } else {
        document.getElementById('app').style.filter = 'blur(3px)';
    }

    document.getElementById('loginButton').addEventListener('click', function () {
        const username = document.getElementById('usernameInput').value;
        if (username) {
            localStorage.setItem('currentUser', username);
            document.getElementById('loginModal').style.display = 'none';
            document.getElementById('app').style.filter = 'none';
            initializeApp();
        } else {
            alert("Please enter a username.");
        }
    });

    function handleUniversityCardInteraction(universityId) {
        // Update the user's interaction history
        userInteractions[universityId] = (userInteractions[universityId] || 0) + 1;

        // Update recommendations based on new interaction
        getRecommendations(currentUser, universityId);
    }

    function initializeApp() {
        // Only run this on the main page
        if (document.getElementById('searchBar')) {
            console.log("Initializing application...");
            fetchCsvData('https://uniview-dynamodb.s3.us-east-2.amazonaws.com/interactions.csv', processUniversityData);
            fetchJsonData('https://uniview-dynamodb.s3.us-east-2.amazonaws.com/personalize_recommendations.json', processPersonalizeRecommendations);
            setupSearchListener();
        }
    }
    function setupSearchListener() {
        const searchBar = document.getElementById('searchBar');
        if (searchBar) {
            searchBar.addEventListener('input', function (e) {
                const searchTerm = e.target.value.toLowerCase();
                const filteredNames = Object.keys(universitiesData).filter(name => name.toLowerCase().includes(searchTerm));
                displayUniversityCards(filteredNames);
            });
        }
    }

    function fetchCsvData(csvUrl, callback) {
        console.log(`Fetching data from: ${csvUrl}`);
        Papa.parse(csvUrl, {
            download: true,
            header: true,
            complete: results => callback(results.data)
        });
    }

    function fetchJsonData(jsonUrl, callback) {
        console.log(`Fetching data from: ${jsonUrl}`);
        fetch(jsonUrl)
            .then(response => response.json())
            .then(data => callback(data))
            .catch(error => console.error('Error fetching JSON:', error));
    }
    function processPersonalizeRecommendations(data) {
        console.log("Processing Personalize recommendations...");
        personalizeRecommendations = data;
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

    function displayUniversityDetails(name) {
        const details = universitiesData[name];
        createModal(name, details);
        getRecommendations(currentUser, name);
        handleUniversityCardInteraction(name);  // Update user interactions
        getRecommendations(currentUser, name);
    }

    function getRecommendations(userId, universityId) {
        let recommendedUniversities;

        if (Object.keys(userInteractions).length >= 5) {
            recommendedUniversities = calculatePersonalizedRecommendations(userId);
        } else {
            recommendedUniversities = getInitialRecommendations(universityId);
        }

        updateRecommendationsList(recommendedUniversities, universityId);
    }

    function calculatePersonalizedRecommendations(userId) {
        // Gather universities the user has interacted with
        let interactedUniversities = Object.keys(userInteractions);

        // Calculate average sentiment scores for each interacted university
        let averageSentiments = interactedUniversities.map(universityId => {
            let scores = universitiesData[universityId].sentimentScores;
            let avgPositive = scores.reduce((acc, curr) => acc + curr.positive, 0) / scores.length;
            let avgNegative = scores.reduce((acc, curr) => acc + curr.negative, 0) / scores.length;
            return { universityId, avgPositive, avgNegative };
        });

        // Sort interacted universities by positive sentiment score
        averageSentiments.sort((a, b) => b.avgPositive - a.avgPositive);

        // Find universities with similar sentiment scores
        let recommendedUniversities = [];
        averageSentiments.forEach(sentiment => {
            Object.keys(universitiesData).forEach(universityId => {
                if (!userInteractions[universityId]) {
                    let scores = universitiesData[universityId].sentimentScores;
                    let avgPositive = scores.reduce((acc, curr) => acc + curr.positive, 0) / scores.length;
                    let avgNegative = scores.reduce((acc, curr) => acc + curr.negative, 0) / scores.length;

                    if (Math.abs(avgPositive - sentiment.avgPositive) < 0.1 && Math.abs(avgNegative - sentiment.avgNegative) < 0.1) {
                        recommendedUniversities.push(universityId);
                    }
                }
            });
        });

        // Remove duplicates and limit to top 5 recommendations
        return [...new Set(recommendedUniversities)].slice(0, 5);
    }


    function getInitialRecommendations(currentUniversityId) {
        // Provide initial recommendations based on Personalize data
        let recommendations = personalizeRecommendations[currentUniversityId]?.recommendedItems;
        return recommendations ? recommendations.slice(0, 5) : []; // Limit to top 5
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
                recommendationsList.innerHTML = ''; // Clear existing recommendations
                recommendedUniversities.forEach(recommendedUniversity => {
                    // Create a card for each recommended university
                    const card = document.createElement('div');
                    card.className = 'university-card';
                    card.textContent = recommendedUniversity;
                    card.onclick = () => displayUniversityDetails(recommendedUniversity);
                    recommendationsList.appendChild(card);
                });
            } else {
                recommendationsList.innerHTML = '<div>No recommendations available</div>';
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
