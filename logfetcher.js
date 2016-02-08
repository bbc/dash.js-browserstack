/**
 * Takes a sessions.json, which is generated by specrunner.js,
 * and downloads the videos of th BrowserStack sessions.
 * Written for Node 0.12
 */
require('./lib/polyfill');
var request = require('request');
var fs = require('fs');
var runs = require('./sessions.json');
var report = require('./report.json');
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

var html = '<html><head><meta charset="UTF-8"><title>Dash.js BrowserStack Run Logs</title></head><body>';
html += '<div style="position:fixed;top:0;right:0;background-color:#333;padding:1em">Jump to: <a href="#log">Log</a> | <a href="#capabilities">Videos</a></div>'
var waiting = 0;
if (process.env.BUILD_NUMBER) {
    // Upload the build log thus far
    var log = fs.readFileSync(process.env.WORKSPACE + '/../builds/' + process.env.BUILD_NUMBER + '/log', 'utf8');
    var lines = log.split('\n');
    // Skip everything up to the BrowserStackLocal init
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('Press Ctrl-C to exit') > -1) {
            break;
        }
    }
    html += '<h2><a name="log">Build log</a></h2><pre>' + lines.slice(i + 1).join('\n') + '</pre>';
}

html += '<h2><a name="capabilities">Capability Videos</a></h2>';

function store_run(run) {
    var i;
    var passes = 0;
    var fails = 0;
    var auth_string = commander.user + ':' + commander.key;

    request.get({
        url: 'https://' + auth_string + '@www.browserstack.com/automate/sessions/' + runs[run] + '.json',
        json: true
    },
    function(error, response, body) {
        html += '<h3>' + run + '</h3>';
        for (i = 0; i < report.tests.length; i++) {
            if (report.tests[i].fullTitle.startsWith(run)) {
                if (report.tests[i].err) {
                    fails++;
                } else {
                    passes++;
                }
            }
        }
        if (fails > 0) {
            html += '<p style="color:red;font-weight:bold">' + fails + ' tests failing</p>';
        }
        html += passes + '/' + (passes + fails) + ' passing<br>';

        if (!error) {
            // Currently the text URL seems to work with curl, but ask for a login for request :(
            var video_url = body.automation_session.video_url;
            //var text_url = body.automation_session.browser_url.replace('https://', 'https://' + auth_string + '@') + '/logs';
            console.log(video_url);
            //console.log(text_url);

            if (video_url) {
                request(video_url).pipe(fs.createWriteStream(outdir + '/' + run + '.mp4'));
                //request(text_url).pipe(fs.createWriteStream(outdir + '/' + run + '.log'));

                html += '<video src="' + run + '.mp4" controls="true" preload="none" width="1024" height="768"></video><br>';
            } else {
                html += '<em>Session had no available video.</em><br>';
            }
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
