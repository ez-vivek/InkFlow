(() => {
    const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    const updateFavicon = (isDark) => {
        const favicon = document.getElementById('app-favicon');
        if (!favicon) {
            return;
        }

        favicon.href = isDark ? 'Images/favicon-dark.png' : 'Images/favicon-light.png';
    };

    updateFavicon(darkScheme.matches);

    if (typeof darkScheme.addEventListener === 'function') {
        darkScheme.addEventListener('change', (event) => updateFavicon(event.matches));
    } else if (typeof darkScheme.addListener === 'function') {
        darkScheme.addListener((event) => updateFavicon(event.matches));
    }
})();