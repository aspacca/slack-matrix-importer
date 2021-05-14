// Usage:
// node index.js -r -u "http://localhost:9000" # remember to add the registration!
// node index.js -p 9000
const fs = require('fs');
const Cli = require("matrix-appservice-bridge").Cli;
const Bridge = require("matrix-appservice-bridge").Bridge;
const AppServiceRegistration = require("matrix-appservice-bridge").AppServiceRegistration;

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

const CHANNELS = require('./mapped_channels.json');
const USERS = require('./mapped_users.json');

function replaceUserCitation(str) {
  return str.replace(/<@([^>]+)>/g, function (citation, userID) {
    if (userID in USERS) {
      return USERS[userID];
    } else {
      return '@' + citation;
    }
  });
}


var htmlEntities = {
  nbsp: ' ',
  cent: '¢',
  pound: '£',
  yen: '¥',
  euro: '€',
  copy: '©',
  reg: '®',
  lt: '<',
  gt: '>',
  quot: '"',
  amp: '&',
  apos: '\''
};

function unescapeHTML(str) {
  return str.replace(/\&([^;]+);/g, function (entity, entityCode) {
    var match;

    if (entityCode in htmlEntities) {
      return htmlEntities[entityCode];
      /*eslint no-cond-assign: 0*/
    } else if (match = entityCode.match(/^#x([\da-fA-F]+)$/)) {
      return String.fromCharCode(parseInt(match[1], 16));
      /*eslint no-cond-assign: 0*/
    } else if (match = entityCode.match(/^#(\d+)$/)) {
      return String.fromCharCode(~~match[1]);
    } else {
      return entity;
    }
  });
}

let bridge;

const DOMAIN = process.env.DOMAIN;
const IMPORT_FOLDER = process.env.IMPORT_FOLDER;
const HOMESERVER_URL = process.env.HOMESERVER_URL;

if (undefined === DOMAIN || undefined === IMPORT_FOLDER || undefined === HOMESERVER_URL) {
  console.log("Please define all ENV variables (DOMAIN, IMPORT_FOLDER, HOMESERVER_URL)");
  process.exit(255);
}

new Cli({
  registrationPath: "slack-matrix-importer-registration.yaml",
  generateRegistration: function(reg, callback) {
    reg.setId(AppServiceRegistration.generateToken());
    reg.setHomeserverToken(AppServiceRegistration.generateToken());
    reg.setAppServiceToken(AppServiceRegistration.generateToken());
    reg.setSenderLocalpart("slackbot");
    callback(reg);
  },
  run: function(port, config) {
    bridge = new Bridge({
      homeserverUrl: HOMESERVER_URL,
      domain: DOMAIN,
      registration: "slack-matrix-importer-registration.yaml",

      controller: {
        onUserQuery: function(queriedUser) {
          return {}; // auto-provision users with no additonal data
        },

        onEvent: function(request, context) {
        }
      }
    });
    console.log("Matrix-side listening on port %s", port);
    bridge.run(port, config).then(async () => {
      let importFolders = fs.readdirSync(IMPORT_FOLDER).sort();
      await asyncForEach(importFolders, async (channel) => {
        let currentFolder = IMPORT_FOLDER + '/' + channel;
        let stat = fs.statSync(currentFolder);
        if (!stat.isDirectory()) {
          return;
        }

        let importJSON = fs.readdirSync(currentFolder).sort();
        await asyncForEach(importJSON, async (currentJson) => {
          let jsonFile = currentFolder + '/' + currentJson;
          if (currentJson.split('.').pop() !== 'json') {
            return;
          }

          let rawdata = fs.readFileSync(jsonFile);
          let messages = JSON.parse(rawdata).sort(function(a,b) {
            if (a.hasOwnProperty("ts") && b.hasOwnProperty("ts")) {
              if (a["ts"] > b["ts"]) {
                return 1;
              } else if (a["ts"] < b["ts"]) {
                return -1;
              }
            }

            return 0;
          });

          await asyncForEach(messages, async (msg) => {
            if (!msg.hasOwnProperty('user')) {
              return;
            }

            if (!msg.hasOwnProperty('text')) {
              return;
            }
            if (!msg.hasOwnProperty('type') || msg.type !== "message") {
              return;
            }

            if (msg.hasOwnProperty('subtype') && msg.subtype !== "thread_broadcast") {
              return;
            }

            if (!USERS.hasOwnProperty(msg.user)) {
              return;
            }

            if (!CHANNELS.hasOwnProperty(channel)) {
              return;
            }

            let text;
            if (msg.hasOwnProperty('subtype') && msg.subtype === "thread_broadcast") {
              if (msg.hasOwnProperty('root') && msg.root.hasOwnProperty("text")) {
                text = '> ' + msg.root.text + "\n\n" + msg.text;
              } else {
                text = msg.text;
              }
            } else {
              text = msg.text;
            }

            text = unescapeHTML(text);
            text = replaceUserCitation(text);

            let userID = USERS[msg.user];
            let roomID = CHANNELS[channel];

            let intent = bridge.getIntent(userID);
            await console.log(msg.ts, roomID, userID, jsonFile, text);
            await intent.sendText(roomID, text);
          });
        });
      });
    }).catch(function(error) {
      console.log(error)
    });
  }
}).run();
