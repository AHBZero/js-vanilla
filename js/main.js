
let modal;
let searchTimeout;
let currentRequest;
const detailsCache = new Map();
let currentPage = 1;
let totalResults = 0;
let currentQuery = '';

const searchInput = document.getElementById('searchInput');
const resultsGrid = document.getElementById('resultsGrid');
const loading = document.querySelector('.loading');
const errorMessage = document.getElementById('errorMessage');
const noResults = document.querySelector('.no-results');
const tooltip = createTooltip();

const API_KEY = 'ac9fa387';
const BASE_URL = 'https://www.omdbapi.com/';

function isMobile() {
    return window.innerWidth <= 1024;
}

async function searchMovies(query, page) {
    hideMessages();
    loading.style.display = 'block';

    if (currentRequest) {
        currentRequest.abort();
    }

    try {
        const controller = new AbortController();
        currentRequest = controller;

        const response = await fetch(
            `${BASE_URL}?apikey=${API_KEY}&s=${encodeURIComponent(sanitizeQuery(query))}&page=${page}`,
            { signal: controller.signal }
        );

        loading.style.display = 'none';

        const data = await response.json();
        if (data.Response === 'True') {
            totalResults = parseInt(data.totalResults, 10);
            displayResults(data.Search, page === 1);
        } else {
            if (page === 1) {
                noResults.style.display = 'block';
                resultsGrid.innerHTML = '';
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            loading.style.display = 'none';
            showError('Failed to search movies. Please try again.');
        }
    }
}

function displayResults(movies, isNewSearch) {
    if (isNewSearch) {
        resultsGrid.innerHTML = '';
    }

    const newMovies = movies.map(movie => {
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card hidden';
        movieCard.dataset.id = movie.imdbID;
        movieCard.innerHTML = `
            <img class="movie-poster" 
                 alt="${movie.Title}">
            <div class="movie-info">
                <h3 class="movie-title">${movie.Title}</h3>
                <span class="movie-type ${movie.Type}">${movie.Type}</span>
            </div>
        `;

        const posterImg = movieCard.querySelector('.movie-poster');
        posterImg.src = 'assets/svg/placeholder.svg'; // Define o placeholder inicialmente

        const posterSrc = movie.Poster;

        if (posterSrc && posterSrc !== 'N/A') {
            const cacheKey = `poster_${movie.imdbID}`;
            const cachedImage = imageCache.get(cacheKey);

            if (cachedImage) {
                posterImg.src = cachedImage;
            } else {
                const image = new Image();
                image.src = posterSrc;
                image.onload = () => {
                    fetch(posterSrc)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Network response was not ok');
                            }
                            return response.blob();
                        })
                        .then(blob => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64data = reader.result;
                                posterImg.src = base64data;
                                imageCache.set(cacheKey, base64data);
                            };
                            reader.readAsDataURL(blob);
                        });
                };
            }
        }

        return movieCard;
    });

    resultsGrid.append(...newMovies);

    setTimeout(() => {
        newMovies.forEach(card => card.classList.remove('hidden'));
    }, 10);
}

function sanitizeQuery(input) {
    let sanitized = input.trim();                         // Remove whitespaces
    sanitized = sanitized.replace(/<[^>]*>?/gm, '');      // Remove HTML/JS tags
    sanitized = sanitized.replace(/[^\w\s\-.,]/gi, '');   // Remove dangerous common chars
    sanitized = sanitized.substring(0, 50);               // Limit size
    return sanitized;
}

function createTooltip() {
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'tooltip';
    document.body.appendChild(tooltipEl);
    return tooltipEl;
}

function updateTooltipContent(movie) {
    tooltip.innerHTML = `
        <div class="tooltip-title"><strong>Title:</strong> ${movie.Title}</div>
        <div class="tooltip-title"><strong>Year:</strong> ${movie.Year}</div>
        <div class="tooltip-title"><strong>Director:</strong> ${movie.Director}</div>
        <div class="tooltip-title"><strong>Genre:</strong> ${movie.Genre}</div>
        <div class="tooltip-title"><strong>Rating:</strong> ${movie.imdbRating}/10</div>
    `;
}

function createModal() {
    if (document.getElementById('movieModal')) {
        modal = document.getElementById('movieModal');
        return;
    }

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = `
        <div id="movieModal" class="modal">
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <div id="modalBody"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modalContainer);
    modal = document.getElementById('movieModal');

    const closeButton = modal.querySelector('.close-button');
    closeButton.addEventListener('click', hideModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            hideModal();
        }
    });
}

function updateModalContent(movie) {
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <h2>${movie.Title}</h2>
        <p><strong>Year:</strong> ${movie.Year}</p>
        <p><strong>Director:</strong> ${movie.Director}</p>
        <p><strong>Genre:</strong> ${movie.Genre}</p>
        <p><strong>Rating:</strong> ${movie.imdbRating}/10</p>
    `;
}

async function handleCardClick(e) {
    if (!isMobile()) return;

    const card = e.target.closest('.movie-card');
    if (!card) return;

    createModal();

    const imdbId = card.dataset.id;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = '<div class="tooltip-title">Loading...</div>';

    showModal();

    if (detailsCache.has(imdbId)) {
        const { data, timeoutId } = detailsCache.get(imdbId);
        clearTimeout(timeoutId);
        const newTimeoutId = setTimeout(() => detailsCache.delete(imdbId), 5 * 60 * 1000);
        detailsCache.set(imdbId, { data, timeoutId: newTimeoutId });
        updateModalContent(data);
    } else {
        try {
            const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&i=${imdbId}`);
            const movie = await response.json();
            if (movie.Response === 'True') {
                const timeoutId = setTimeout(() => detailsCache.delete(imdbId), 5 * 60 * 1000);
                detailsCache.set(imdbId, { data: movie, timeoutId });
                updateModalContent(movie);
            } else {
                modalBody.innerHTML = '<div class="tooltip-title">Error loading details.</div>';
            }
        } catch (error) {
            modalBody.innerHTML = '<div class="tooltip-title">Error loading details.</div>';
        }
    }
}

//- FEEDBACK ---------------------------------------------------------------------------------------------------------------------------

function showModal() {
    if (!modal) createModal();
    modal.style.display = 'block';
}

function hideModal() {
    modal.style.display = 'none';
}

function hideMessages() {
    loading.style.display = 'none';
    errorMessage.style.display = 'none';
    noResults.style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    resultsGrid.innerHTML = '';
}

async function showTooltip(e) {
    if (isMobile()) return;
    const card = e.target.closest('.movie-card');
    if (!card) return;

    const imdbId = card.dataset.id;
    tooltip.classList.add('visible');

    if (detailsCache.has(imdbId)) {
        const { data, timeoutId } = detailsCache.get(imdbId);
        clearTimeout(timeoutId); // Refresh cache timeout
        const newTimeoutId = setTimeout(() => detailsCache.delete(imdbId), 5 * 60 * 1000); // 5min cache
        detailsCache.set(imdbId, { data, timeoutId: newTimeoutId });
        updateTooltipContent(data);
    } else {
        tooltip.innerHTML = '<div class="tooltip-title">Loading...</div>';
        try {
            const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&i=${imdbId}`);
            const movie = await response.json();
            if (movie.Response === 'True') {
                const timeoutId = setTimeout(() => detailsCache.delete(imdbId), 5 * 60 * 1000);
                detailsCache.set(imdbId, { data: movie, timeoutId });
                updateTooltipContent(movie);
            }
        } catch (error) {
            tooltip.innerHTML = '<div class="tooltip-title">Error</div>';
        }
    }
}

function hideTooltip() {
    if (isMobile()) return;
    tooltip.classList.remove('visible');
}

function moveTooltip(e) {
    if (isMobile()) return;
    tooltip.style.left = e.pageX + 10 + 'px';
    tooltip.style.top = e.pageY + 10 + 'px';
}

//- CACHE ---------------------------------------------------------------------------------------------------------------------------

const imageCache = {
    CACHE_LIMIT: 100,
    get(key) {
        const item = localStorage.getItem(key);
        if (item) {
            this.updateMru(key);
            return item;
        }
        return null;
    },
    set(key, value) {
        try {
            localStorage.setItem(key, value);
            this.updateMru(key);
            this.evict();
        } catch (e) {
            console.error("Failed to save to localStorage", e);
            this.evict(true);
            try {
                localStorage.setItem(key, value);
                this.updateMru(key);
            } catch (e2) {
                console.error("Still failed to save to localStorage after eviction", e2);
            }
        }
    },
    updateMru(key) {
        let mru = JSON.parse(localStorage.getItem('imageCacheMru') || '[]');
        const index = mru.indexOf(key);
        if (index > -1) {
            mru.splice(index, 1);
        }
        mru.push(key);
        localStorage.setItem('imageCacheMru', JSON.stringify(mru));
    },
    evict(force = false) {
        let mru = JSON.parse(localStorage.getItem('imageCacheMru') || '[]');
        if (force || mru.length > this.CACHE_LIMIT) {
            const toEvictCount = force ? Math.max(1, Math.floor(mru.length * 0.1)) : mru.length - this.CACHE_LIMIT;
            const toEvict = mru.splice(0, toEvictCount);
            for (const key of toEvict) {
                localStorage.removeItem(key);
            }
            localStorage.setItem('imageCacheMru', JSON.stringify(mru));
        }
    }
};

//- EVENTS ---------------------------------------------------------------------------------------------------------------------------

resultsGrid.addEventListener('mouseover', showTooltip);
resultsGrid.addEventListener('mouseout', hideTooltip);
resultsGrid.addEventListener('mousemove', moveTooltip);
resultsGrid.addEventListener('click', handleCardClick);

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    clearTimeout(searchTimeout);

    if (query.length < 3) {
        resultsGrid.innerHTML = '';
        hideMessages();
        return;
    }

    searchTimeout = setTimeout(() => {
        currentQuery = query;
        currentPage = 1;
        resultsGrid.innerHTML = '';
        searchMovies(currentQuery, currentPage);
    }, 500);
});

window.addEventListener('scroll', () => {
    if (loading.style.display === 'block') return;

    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
        const totalPages = Math.ceil(totalResults / 10);
        if (currentPage < totalPages) {
            currentPage++;
            searchMovies(currentQuery, currentPage);
        }
    }
});