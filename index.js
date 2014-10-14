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

twit.verifyCredentials(function (err, data) {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    console.log('Credentials verified.');

    function tweetAMessage(message, inReplyTo) {
        twit.updateStatus(message, {in_reply_to_status_id: inReplyTo}, function (err, data) {
            if (err) {
                console.error('Error while trying to send tweet:');
                console.error(err);
                //process.exit(1);
            }
        });

    }

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

        var tweetContext = getContextForUser(tweet.user);
        if (tweetContext) {
            console.log('tweet received: %s', tweet.text);
            var reply = tweetContext.bot.transform(tweet.text);
            reply = '@' + tweet.user.screen_name + " " + reply;
            if (reply.length > 140) {
                return; // Twitter doesn't like that.
            }
            console.log('reply:          %s', reply);
            setTimeout(function() {
                tweetAMessage(reply, tweet.id_str);
            }, config.tweetReplySpeed)
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


