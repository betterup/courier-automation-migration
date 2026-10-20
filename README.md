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

Courier does not copy subscription topics from US to EU, and the template sync
keeps the US topic id on each EU template. So a new topic must exist in EU with
the same id as in US. The public API and the Studio editor always make a new id.
`subscription-topics/copy-to-eu.js` copies the topics you name, with their ids,
through the same Studio API as the automation sync. Setup is the same as above.
Run it from the repo root, where `.env` is.

```bash
$ node subscription-topics/copy-to-eu.js <environment> <topic_id> [<topic_id> ...]          # dry run
$ node subscription-topics/copy-to-eu.js <environment> <topic_id> [<topic_id> ...] --apply  # write
```

`environment` must equal `test` or `production`. Test and production keep
separate topics, so run it for each.

- Without `--apply` it only reads. For each topic it shows the US section, whether
  EU has the topic with the same id, and any EU topic with the same name and
  another id.
- With `--apply` it creates the topic's section in EU if EU does not have it,
  copies each topic that EU does not have, then reads EU again.
- It changes only the topics you name. It does not save existing sections again,
  change topics that EU already has, or link templates (the template sync does
  that).
- It stops before writing if US does not have a topic id, and stops at once if
  EU saves a section or topic with another id.

Run `--apply` in `test` first and check the EU test dashboard before
`production`.

To run the tests: `yarn test`.

## Troubleshooting

### JWT expired error

The `US_AUTHORIZATION` or `EU_AUTHORIZATION` values are stale. Repeat setup steps 3-4 and try again.
