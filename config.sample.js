module.exports = {
	twitterCredentials: {
	    consumer_key: 'xxx',
	    consumer_secret: 'xxx',
	    access_token_key: 'xxx',
	    access_token_secret: 'xxx'
    },
    contextTimeout: 60 * 60 * 1000,
    tweetInterval: 60 * 1000,
    maxContexts: 50,
    search: ['#somehashtag'],
    twitterUsername: 'xxx',
    backOffIntervalInital: 65 * 1000,
    blockWords: ['bot', 'leave me'],
    queueItemLifetime: 5 * 60 * 1000
}