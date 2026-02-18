# n8n-nodes-ajv-json-validator

[![npm version](https://img.shields.io/npm/v/n8n-nodes-ajv-json-validator.svg)](https://www.npmjs.com/package/n8n-nodes-ajv-json-validator)

An n8n community node that validates JSON data against a JSON Schema using [AJV](https://ajv.js.org/), with dual-output routing for valid and invalid items.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation) | [Features](#features) | [Usage](#usage) | [Compatibility](#compatibility) | [Resources](#resources) | [Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. Search for **n8n-nodes-ajv-json-validator** in the community nodes panel.

## Features

- **JSON Schema Draft-07** validation powered by AJV
- **Dual outputs** — valid items route to the first output, invalid items route to the second
- **Format validation** — email, date, URI, and more via `ajv-formats`
- **Custom error messages** via `ajv-errors`
- **All-errors mode** — reports every validation error, not just the first
- **Batch processing** — validates each input item individually and routes them accordingly
- **continueOnFail support** — when enabled, unexpected errors send all items to the Invalid output instead of stopping the workflow

## Usage

1. Add the **JSON Validator** node to your workflow.
2. Configure the **JSON Schema** parameter with a valid JSON Schema (Draft-07).
3. Connect downstream nodes to the two outputs:
   - **Output 1 (Valid)** — items that pass validation, returned unchanged.
   - **Output 2 (Invalid)** — items that fail validation. Each item contains:
     - `error` — the validation error message
     - `item` — the original input data

If the schema itself is invalid, an error item is sent to the Invalid output.

## Compatibility

- n8n >= 1.0
- Node.js >= 20.15

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [JSON Schema specification](https://json-schema.org/)
- [AJV documentation](https://ajv.js.org/)

## Version history

- **0.2.3** — Current release. Updated README documentation.
- **0.2.2** — Bumped version.
- **0.2.1** — Renamed package to `n8n-nodes-ajv-json-validator`. Added test workflow and dev tooling.
- **0.1.0** — Initial release with JSON Schema validation via AJV.
