/**
 * Takes a sessions.json, which is generated by specrunner.js,
 * and downloads the videos of th BrowserStack sessions.
 * Written for Node 0.12
 */
var request = require('request');
var fs = require('fs');
var runs = require('./sessions.json');
var commander = require('commander');

commander.option('-u, --user [user]', 'The BrowserStack API user to use.')
    .option('-k, --key [key]', 'The BrowserStack API key to use.')
    .parse(process.argv);

var outdir = 'logs/';
if (process.env.BUILD_TAG) {
    outdir += process.env.BUILD_TAG;
}

try {
    fs.accessSync('logs', fs.F_OK);
} catch (e) {
    fs.mkdirSync('logs');
}
try {
    fs.accessSync(outdir, fs.F_OK);
} catch (e) {
    fs.mkdirSync(outdir);
}

var html = '<html><head><title>Dash.js BrowserStack Run Logs</title></head><body>';
var waiting = 0;
if (process.env.BUILD_NUMBER) {
    // Upload the build log thus far
    fs.createReadStream(process.env.WORKSPACE + '/../builds/' + process.env.BUILD_NUMBER + '/log').pipe(fs.createWriteStream(outdir + '/build.log'));
    html += '<a href="build.log">Build Log</a><br>';
}

function store_run(run) {
    var auth_string = commander.user + ':' + commander.key;
    request.get({
        url: 'https://' + auth_string + '@www.browserstack.com/automate/sessions/' + runs[run] + '.json',
        json: true
    },
    function(error, response, body) {
        if (!error) {
            // Currently the text URL seems to work with curl, but ask for a login for request :(
            var video_url = body.automation_session.video_url;
            //var text_url = body.automation_session.browser_url.replace('https://', 'https://' + auth_string + '@') + '/logs';
            console.log(video_url);
            //console.log(text_url);

            request(video_url).pipe(fs.createWriteStream(outdir + '/' + run + '.mp4'));
            //request(text_url).pipe(fs.createWriteStream(outdir + '/' + run + '.log'));

            html += '<h2>' + run + '</h2><a href="' + run + '.mp4">Video</a><br>';
        }
        waiting--;
        if (waiting === 0) {
            html += '</body></html>';
            fs.writeFileSync(outdir + '/index.html', html);
        }
    });
}

for (var run in runs) {
    if (runs.hasOwnProperty(run)) {
        waiting++;
        store_run(run);
    }
}
