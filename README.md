# Courier Automation Sync

`🇺🇸 => 🇪🇺`

A script to copy the latest published automations US instance of Courier to the EU instance of Courier and mutate automation content as needed.

Run every time an automation is changed in US.

## Setup

Make sure you have `node` installed and run `yarn`.

1. `cp .env.example .env`
2. Log into both the Courier US and EU instances. 
3. Open the network tab and inspect any XHR request to `api{.eu}.courier.com/studio/q?=` and copy the `authorization`
   value (JWT)
4. Paste these values into their respective `US_AUTHORIZATION` and `EU_AUTHORIZATION` environment keys.
5. Copy the `tenant_id` query param from the request and use in the `TENANT_ID` environment key.

## Running the script

```bash
$ node index.js <environment>
```

`environment` must equal `test` or `production`. By default it will run in `test`

## Copying subscription topics

### Why

Courier does not copy subscription topics from US to EU. The template sync
copies each template to EU with its US topic id, and it does not look for a
matching EU topic. So each topic must exist in EU with the same id as in US.
Courier's public API and the Preferences editor always make a new id.

`subscription-topics/copy-to-eu.js` copies the topics you name from US to EU,
with their ids.

### Run it

Setup is the same as above. Run it from the repo root, where `.env` is.

```bash
$ node subscription-topics/copy-to-eu.js <environment> <topic_id> [<topic_id> ...]          # dry run
$ node subscription-topics/copy-to-eu.js <environment> <topic_id> [<topic_id> ...] --apply  # write
```

`environment` must equal `test` or `production`. Test and production keep
separate topics, so run it for each. Do this in order:

1. Dry run in `test` and in `production`. Add the id of a topic that you know
   EU already has. It must show `EU: same id`. If it shows `missing`, the
   script does not read the EU workspace that you expect: stop.
2. `--apply` in `test`, then in `production`. Each run reads EU back and fails
   if a topic is still missing.
3. Check that a template that uses one of the topics reaches EU with its topic,
   after the template sync.

### What it does

It uses Courier Studio's internal GraphQL API (`studio/q`), the API that the
dashboard itself uses, with your dashboard session. This API is not
documented, and it can change without notice. A call can answer with no
error and still save nothing, so trust the read back and the dashboard, not the
answer to a save.

- It reads the US sections and their topics (`preferenceSections`), the EU
  sections, and every EU topic (`preferenceTemplates`). Only the second list
  has the topics that are in no section.
- Without `--apply` it writes nothing. For each topic it shows the US section,
  whether EU has the topic with the same id and in which section, and any EU
  topic with the same name and another id.
- With `--apply`, for each named topic that EU does not have, it saves the
  topic with its US id (`savePreferenceTemplate`). Then it adds the topic to the
  EU section that has the US section id (`addPreferenceGroup`), if EU has one.
- It does not create sections. A new section saved with an older-format id
  (not `ps_...`) answered with no error, but Courier did not keep it. Section
  ids do not need to match between US and EU: templates point to topics, not
  to sections. When EU has no section with the US section id, the topic goes
  in no section. It still has its id, but the Preferences editor shows only
  topics that are in a section, so you cannot see it there.
- It changes only the topics that you name and that EU does not have. It does
  not change topics that EU already has, or link templates (the template sync
  does that). It does not read the templates linked to each topic: on the US
  server that field timed out.
- It stops before any write if US does not have a topic id, at once if EU saves
  a topic with another id, and on any error in a response. It never prints the
  request headers.

The tenant id is the same in US and EU. The dashboard JWTs last about one
hour. One JWT per region covers test and production.

To run the tests: `yarn test`.

## Troubleshooting

### JWT expired error

The `US_AUTHORIZATION` or `EU_AUTHORIZATION` values are stale. Repeat setup steps 3-4 and try again.
