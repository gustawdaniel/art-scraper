// This script runs on invaluable.com search pages

async function scrapeAndSend() {
  const hitHolders = document.querySelectorAll('.hit-holder:not(.art-scraper-processed)');
  
  if (hitHolders.length === 0) {
    console.log("Art Scraper: No new items found.");
    tryLoadMore();
    return;
  }

  const artworks = [];
  const processedElements = [];

  hitHolders.forEach(holder => {
    // Mark as processed so we don't scrape it again while waiting for API
    holder.classList.add('art-scraper-processed');
    holder.style.backgroundColor = 'gray';
    processedElements.push(holder);

    let auctionLink = '';
    let imageLink = '';
    let title = '';
    let date = '';
    let auctionHouse = '';

    // Extract Auction Link & Title
    const lotTitleLink = holder.querySelector('a.lot-title');
    if (lotTitleLink) {
      auctionLink = lotTitleLink.href;
      title = lotTitleLink.innerText.trim();
    } else {
      // Fallback: look for generic anchor inside image-holder
      const genericLink = holder.querySelector('.image-holder a');
      if (genericLink) auctionLink = genericLink.href;
    }

    // Extract Image Link
    const img = holder.querySelector('.image-holder img');
    if (img) {
      imageLink = img.getAttribute('data-src') || img.getAttribute('src') || '';
    }

    // Extract Date & Auction House
    const textHolders = holder.querySelectorAll('.content-holder .text-holder');
    if (textHolders.length >= 3) {
      const dateSpan = textHolders[0].querySelector('span');
      if (dateSpan) date = dateSpan.innerText.trim();
      else date = textHolders[0].innerText.trim();
      
      auctionHouse = textHolders[2].innerText.trim();
    }

    if (auctionLink && imageLink) {
      artworks.push({
        auctionLink,
        imageLink,
        title,
        date,
        auctionHouse
      });
    }
  });

  if (artworks.length > 0) {
    try {
      console.log(`Art Scraper: Sending ${artworks.length} items to API...`);
      const response = await fetch('http://localhost:3001/api/artworks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(artworks)
      });

      if (response.ok) {
        processedElements.forEach(el => {
          el.style.backgroundColor = 'green';
        });
        console.log("Art Scraper: Successfully saved items.");
      } else {
        console.error("Art Scraper: API responded with an error.", await response.text());
        processedElements.forEach(el => {
          el.style.backgroundColor = 'red';
        });
      }
    } catch (err) {
      console.error("Art Scraper: Failed to send data to API", err);
      processedElements.forEach(el => {
        el.style.backgroundColor = 'red';
      });
    }
  }

  // Set timeout to try loading more
  setTimeout(tryLoadMore, 2000);
}

function tryLoadMore() {
  const loadMoreBtn = document.querySelector('.btn.btn-secondary.load-more-btn');
  if (loadMoreBtn && !loadMoreBtn.disabled && loadMoreBtn.style.display !== 'none') {
    console.log("Art Scraper: Clicking Load More button.");
    loadMoreBtn.click();
    // Wait for elements to load, then scrape again
    setTimeout(scrapeAndSend, 4000);
  } else {
    console.log("Art Scraper: Load More button not found or disabled. Waiting for dynamic content or done.");
    // In case new content is loaded by scrolling or asynchronously without button click
    setTimeout(scrapeAndSend, 5000);
  }
}

// Initial run
console.log("Art Scraper extension initialized.");
setTimeout(scrapeAndSend, 3000);
