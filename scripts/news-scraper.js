const { chromium } = require('playwright');
const fs = require('fs').promises;

class NewsScraper {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    async init() {
        this.browser = await chromium.launch({ headless: false });
        this.context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        this.page = await this.context.newPage();
    }

    async scrapeBBCNews(category = 'world') {
        console.log(`Scraping BBC News: ${category}`);
        
        const urls = {
            world: 'https://www.bbc.com/news/world',
            technology: 'https://www.bbc.com/news/technology',
            business: 'https://www.bbc.com/news/business',
            science: 'https://www.bbc.com/news/science_and_environment'
        };
        
        const url = urls[category] || urls.world;
        
        try {
            await this.page.goto(url, { waitUntil: 'networkidle' });
            
            // Accept cookies if present
            try {
                await this.page.click('button:has-text("Accept")', { timeout: 3000 });
            } catch(e) { /* Cookie button not found */ }
            
            const articles = await this.page.evaluate(() => {
                const newsItems = [];
                
                // Find all article elements
                document.querySelectorAll('[data-testid="card"]').forEach((card, index) => {
                    if (index < 20) { // Limit to 20 articles
                        const title = card.querySelector('[data-testid="card-headline"]')?.textContent?.trim();
                        const description = card.querySelector('[data-testid="card-description"]')?.textContent?.trim();
                        const link = card.querySelector('a')?.href;
                        const image = card.querySelector('img')?.src;
                        
                        if (title) {
                            newsItems.push({
                                title,
                                description: description || '',
                                link,
                                image,
                                source: 'BBC News',
                                category: 'world'
                            });
                        }
                    }
                });
                
                return newsItems;
            });
            
            console.log(`Found ${articles.length} articles from BBC`);
            return articles;
            
        } catch (error) {
            console.error(`BBC scraping failed: ${error.message}`);
            return [];
        }
    }

    async scrapeTheGuardian(section = 'uk') {
        console.log(`craping The Guardian: ${section}`);
        
        const url = `https://www.theguardian.com/${section}`;
        
        try {
            await this.page.goto(url, { waitUntil: 'networkidle' });
            
            const articles = await this.page.evaluate(() => {
                const newsItems = [];
                
                document.querySelectorAll('[data-link-name="article"]').forEach((article, index) => {
                    if (index < 20) {
                        const title = article.querySelector('h3')?.textContent?.trim();
                        const link = article.querySelector('a')?.href;
                        
                        if (title && link) {
                            newsItems.push({
                                title,
                                link,
                                source: 'The Guardian',
                                section: window.location.pathname.split('/')[1]
                            });
                        }
                    }
                });
                
                return newsItems;
            });
            
            console.log(`Found ${articles.length} articles from The Guardian`);
            return articles;
            
        } catch (error) {
            console.error(`Guardian scraping failed: ${error.message}`);
            return [];
        }
    }

    async scrapeRedditTopPosts(subreddit = 'worldnews', limit = 25) {
        console.log(`Scraping r/${subreddit} top posts`);
        
        const url = `https://www.reddit.com/r/${subreddit}/top/?t=day`;
        
        try {
            await this.page.goto(url, { waitUntil: 'networkidle' });
            
            // Wait for posts to load
            await this.page.waitForSelector('[data-testid="post-container"]', { timeout: 10000 });
            
            const posts = await this.page.evaluate((limit) => {
                const postsList = [];
                
                document.querySelectorAll('[data-testid="post-container"]').forEach((post, index) => {
                    if (index < limit) {
                        const title = post.querySelector('h3')?.textContent?.trim();
                        const score = post.querySelector('[data-testid="post-score"]')?.textContent?.trim();
                        const comments = post.querySelector('[data-testid="comments-count-link"]')?.textContent?.trim();
                        const author = post.querySelector('[data-testid="post_author"]')?.textContent?.trim();
                        const url = post.querySelector('a[data-click-id="body"]')?.href;
                        
                        if (title) {
                            postsList.push({
                                title,
                                score: score || '0',
                                comments: comments || '0',
                                author: author || 'unknown',
                                url,
                                subreddit: window.location.pathname.split('/')[2]
                            });
                        }
                    }
                });
                
                return postsList;
            }, limit);
            
            console.log(`Found ${posts.length} posts from r/${subreddit}`);
            return posts;
            
        } catch (error) {
            console.error(`Reddit scraping failed: ${error.message}`);
            return [];
        }
    }

    async scrapeHackerNews(limit = 30) {
        console.log(`Scraping Hacker News top stories`);
        
        try {
            await this.page.goto('https://news.ycombinator.com/', { waitUntil: 'networkidle' });
            
            const stories = await this.page.evaluate((limit) => {
                const storiesList = [];
                const rows = document.querySelectorAll('.athing');
                
                rows.forEach((row, index) => {
                    if (index < limit) {
                        const titleElement = row.querySelector('.titleline > a');
                        const title = titleElement?.textContent?.trim();
                        const url = titleElement?.href;
                        const subtext = row.nextElementSibling;
                        const points = subtext?.querySelector('.score')?.textContent?.trim();
                        const author = subtext?.querySelector('.hnuser')?.textContent?.trim();
                        const comments = subtext?.querySelector('a:last-child')?.textContent?.trim();
                        
                        if (title) {
                            storiesList.push({
                                title,
                                url,
                                points: points || '0 points',
                                author: author || 'unknown',
                                comments: comments || '0 comments',
                                rank: index + 1
                            });
                        }
                    }
                });
                
                return storiesList;
            }, limit);
            
            console.log(`Found ${stories.length} stories from Hacker News`);
            return stories;
            
        } catch (error) {
            console.error(`Hacker News scraping failed: ${error.message}`);
            return [];
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Generate markdown report
function generateMarkdownReport(data) {
    let markdown = `# News Report\n`;
    markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    // Add each source
    for (const [source, articles] of Object.entries(data)) {
        if (articles.length > 0) {
            markdown += `## ${source.replace('_', ' ').toUpperCase()}\n\n`;
            
            articles.slice(0, 10).forEach((article, idx) => {
                markdown += `${idx + 1}. **${article.title}**\n`;
                if (article.description) markdown += `   ${article.description}\n`;
                if (article.link) markdown += `   ${article.link}\n`;
                if (article.score) markdown += `   Score: ${article.score} | 💬 ${article.comments}\n`;
                markdown += `\n`;
            });
        }
    }
    
    return markdown;
}

async function main() {
    const scraper = new NewsScraper();
    await scraper.init();
    
    try {
        const allNews = {};
        
        // Scrape from multiple sources
        console.log('\nStarting news aggregation...\n');
        
        // BBC News
        allNews.bbc_world = await scraper.scrapeBBCNews('world');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        allNews.bbc_tech = await scraper.scrapeBBCNews('technology');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // The Guardian
        allNews.guardian_uk = await scraper.scrapeTheGuardian('uk');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        allNews.guardian_tech = await scraper.scrapeTheGuardian('technology');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Reddit
        allNews.reddit_worldnews = await scraper.scrapeRedditTopPosts('worldnews', 15);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        allNews.reddit_technology = await scraper.scrapeRedditTopPosts('technology', 15);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Hacker News
        allNews.hackernews = await scraper.scrapeHackerNews(25);
        
        // Save as JSON
        await fs.writeFile('news_data.json', JSON.stringify(allNews, null, 2));
        console.log('\nJSON data saved to news_data.json');
        
        // Generate and save markdown report
        const markdownReport = generateMarkdownReport(allNews);
        await fs.writeFile('news_report.md', markdownReport);
        console.log('Markdown report saved to news_report.md');
        
        // Summary
        let totalArticles = 0;
        for (const [source, articles] of Object.entries(allNews)) {
            totalArticles += articles.length;
            console.log(`${source}: ${articles.length} articles`);
        }
        console.log(`\nTotal articles scraped: ${totalArticles}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await scraper.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = NewsScraper;