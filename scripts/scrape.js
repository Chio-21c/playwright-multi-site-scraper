const { chromium } = require('playwright');

async function scrapeExample() {
    // Launch browser 
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 100 
    });
    
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to website...');
        await page.goto('https://books.toscrape.com', {
            waitUntil: 'networkidle' // Waits for network to be idle
        });
        

        const title = await page.title();
        console.log(`Page title: ${title}`);
        

        console.log('Scraping book data...');
        const books = await page.$$eval('.product_pod', (elements) => {
            return elements.map(element => ({
                title: element.querySelector('h3 a')?.getAttribute('title') || 'No title',
                price: element.querySelector('.price_color')?.innerText || 'No price',
                rating: element.querySelector('.star-rating')?.className.split(' ')[1] || 'No rating'
            }));
        });
        

        console.log(`\nFound ${books.length} books:\n`);
        books.slice(0, 5).forEach((book, index) => {
            console.log(`${index + 1}. ${book.title}`);
            console.log(`   Price: ${book.price}`);
            console.log(`   Rating: ${book.rating}\n`);
        });
        

        await page.screenshot({ path: 'screenshot.png', fullPage: true });
        console.log('Screenshot saved as screenshot.png');
        

        const fs = require('fs');
        fs.writeFileSync('books.json', JSON.stringify(books, null, 2));
        console.log('Data saved to books.json');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {

        await browser.close();
        console.log('Browser closed');
    }
}


scrapeExample();