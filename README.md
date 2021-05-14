# slack-matrix-importer
Import a Slack history export to a Matrix server

This README will explain requirements and how to run the script in order to import an export of a Slack workspace data to a Matrix server.
The code is based from https://github.com/matrix-org/matrix-appservice-bridge/blob/develop/HOWTO.md

You need to have:
- A working homeserver install
- An export of a Slack workspace data (https://slack.com/intl/en-de/help/articles/201658943-Export-your-workspace-data)
- `npm` and `nodejs`
- `mapped_channels.json` and `mapped_users.json` files to map from Slack to Matrix users and channels

NB: This how-to refers to the binary `node` - this may be `nodejs` depending on your distro.

# Install dependencies
Checkout the code and enter the directory.
Run `npm install` to install the required dependencies.
```
$ git checkout https://github.com/aspacca/slack-matrix-importer.git
$ cd slack-matrix-importer
$ npm install
```


## Registering as an application service
The scrip setup a CLI via the `Cli` class, which will dump the registration file to
`slack-matrix-importer-registration.yaml`. It will register the user ID `@slackbot:domain` and ask
for exclusive rights (so no one else can create them) to the namespace of every users. It also generates two tokens which will be used for authentication.

Now type `DOMAIN=localhost HOMSEVER_URL=http://localhost:9000 node index.js -r -u "http://localhost:9000"` (HOMSERVER_URL and the last url param are the same URL that the
homeserver will try to use to communicate with the application service, DOMAIN is the DOMAIN of the homserver) and a file
`slack-matrix-importer-registration.yaml` will be produced. In your Synapse install, edit
`homeserver.yaml` to include this file:
```yaml
app_service_config_files: ["/path/to/slack/matrix/importer/slack-matrix-importer-registration.yaml"]
```
Then restart your homeserver. Your application service is now registered.

## Extracting the Slack workspace data export
You need to extract the Slack workspace data export. You can export everywhere since you will be able to point to that directory later in the process (replace SLACK-WORKSPACE-DATA.zip with the name of your export archive file):
```
$ cd /tmp
$ unzip SLACK-WORKSPACE-DATA.zip
```


## Defining mapping for users and channels
We need to create two json files to map the id of the users and channels in Slack to the ones on the homeserver.

- `mapped_users.json`

From `/tmp/SLACK-WORKSPACE-DATA/users.json` find the `id` field of every user
in the Slack server and use them as key of a json object with the id of the matching Matrix user:
```json
{
  "UD34L1FHJ":"@an_user:your-homeserver-domain.com",
  "UL09E7XNM":"@another_user:your-homeserver-domain.com"
}
```

- `mapped_channels.json`

From `/tmp/SLACK-WORKSPACE-DATA/channels.json` find the `name` field of every channel
in the Slack server and use them as key of a json object with the id of the matching Matrix channel:
```json
{
  "a-slack-channel":"!lTyPKoNMeWDiOPlfHn:your-homeserver-domain.com",
  "another-slack-channel":"!KdbHjErWcXpEQfGMki:your-homeserver-domain.com"
 }
```

NB: The `name` field used as key in the json must match the subfolders
with the json files containing the channels messages inside `/tmp/SLACK-WORKSPACE-DATA`  

# Run the import
Run the app service with `DOMAIN=localhost HOMSEVER_URL=http://localhost:9000 IMPORT_FOLDER=/tmp/SLACK-WORKSPACE-DATA node index.js -p 9000` and wait until the last message is print to console and imported on matrix.
Once it's done you can exit with CTRL+C


# Notes
Messages that don't have an entry (either for the user or the channel) in the mapping json files won't be imported.

The messages are sent to the homserver with the `Intent` object obtained from the bridge (https://github.com/matrix-org/matrix-appservice-bridge/blob/develop/README.md#intent).
This would make sure that user you are importing the message from joined to the room first before sending the message.
If the user cannot join the room the message is sent to an exception is thrown and the message won't be imported: it's suggested to have all the users on the homeserver already joined the rooms to import for.   


