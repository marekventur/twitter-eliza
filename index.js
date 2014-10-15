var twitter = require('ntwitter');
var config = require('./config.js');
var stream = new (require('node-tweet-stream'))({
    consumer_key: config.twitterCredentials.consumer_key,
    consumer_secret: config.twitterCredentials.consumer_secret,
    token: config.twitterCredentials.access_token_key,
    token_secret: config.twitterCredentials.access_token_secret
  })
var twit = new twitter(config.twitterCredentials);
var ElizaBot = require('elizabot');
var _ = require('underscore');

var context = {};
var backOffInterval = config.backOffIntervalInital;
var backOffTimer;
var enabled = true;
var messageBacklog = [];

twit.verifyCredentials(function (err, data) {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    console.log('Credentials verified.');

    setInterval(function() {
        if (!enabled) {
            return;
        }

        if (messageBacklog.length === 0) {
            console.log('nothing to tweet :(');
            return;
        }

        messageBacklog.sort(function(a, b){return b.priority-a.priority});

        var message = messageBacklog.shift();

        twit.updateStatus(message.message, {in_reply_to_status_id: message.inReplyTo}, function (err, data) {
            if (err) {
                console.error('Error while trying to send tweet:');
                console.error(err);
                if (_.intersection(_.pluck(err.errors, 'code'), [226, 185])) {

                    enabled = false;
                    clearTimeout(backOffTimer);
                    backOffTimer = setTimeout(function() {
                        backOffInterval *= 2;  
                        enabled = true;
                    }, backOffInterval);
                    console.log('Cooling down for %d ms\n\n', backOffInterval);
                } 
            } else {
                backOffInterval = config.backOffIntervalInital;
            }
        });

    }, config.tweetInterval);

    function getContextForUser(user) {
        if (!context[user.id_str]) {
            if (_.size(context) >= config.maxContexts) {
                console.log('context limit reached, skipping');
                return null;
            }

            var bot = new ElizaBot();
            context[user.id_str] = {
                bot: bot,
                user: user
            };
            console.log('Created new context for user %s (%s)', user.screen_name, user.name);
        }

        context[user.id_str].lastUsed = new Date().getTime();
        return context[user.id_str];
    }

    setInterval(function() {
        var toBeDeleted = [];
        var now = new Date().getTime();
        _.each(context, function(value, key) {
            if (now - value.lastUsed > config.contextTimeout || value.bot.quit) {
                toBeDeleted.push(key);
                console.log('Removing %s', key);
            }
        });
        _.each(toBeDeleted, function(key) {
            delete context[key];
        });
    }, 60 * 1000);  

    // Start listening to twitter
    stream.on('tweet', function (tweet) {
        if (tweet.retweeted_status) {
            return;
        }

        if (tweet.user.screen_name == config.twitterUsername) {
            return; // not replying to myself
        }

        if (!enabled) {
            return; 
        }

        var containsBlockWords = _.some(config.blockWords, function(word) {
            return (tweet.text.indexOf(word) > -1);
        });
        if (containsBlockWords) {
            console.log('caught blockword: %s\n\n', tweet.text);
            return;
        }
        
        var tweetContext = getContextForUser(tweet.user);
        if (tweetContext) {
            console.log('tweet received: %s', tweet.text);
            var reply = tweetContext.bot.transform(tweet.text);
            reply = '@' + tweet.user.screen_name + " " + reply;
            if (reply.length > 140) {
                return; // Twitter doesn't like that.
            }
            console.log('reply:          %s', reply);
            priority = 0;
            if (tweet.in_reply_to_screen_name == config.twitterUsername) {
                priority++;
            }
            console.log('priority:       %d', priority);

            var outdatedTimestamp = new Date().getTime() - config.queueItemLifetime;
            messageBacklog = _.reject(messageBacklog, function(message) {
                if (message.to === tweet.user.screen_name) {
                    return true;
                }

                if (message.timestamp < outdatedTimestamp) {
                    return true;
                }

                return false;
            });

            messageBacklog.push({
                to: tweet.user.screen_name,
                message: reply,
                inReplyTo: tweet.id_str,
                priority:  priority,
                timestamp: (new Date().getTime())
            });
            console.log('backlog size:   %s', messageBacklog.length);

            console.log('\n\n');
        }
    })

    stream.on('error', function (err) {
        console.error('Error while trying to receive tweets:');
        console.error(err);
        process.exit(1);
    });

    config.search.push('@' + config.twitterUsername);// To answer to replies
    _.each(config.search, function(term) {
        console.log('searching for %s', term);
        stream.track(term);
    });

    console.log("\n\n");
})


