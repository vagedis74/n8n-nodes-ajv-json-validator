import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import Ajv, { type SchemaObject } from 'ajv';
import addFormats from 'ajv-formats';
import addErrors from 'ajv-errors';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
addErrors(ajv);

export class JsonValidatorV1 implements INodeType {
	description: INodeTypeDescription;

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = {
			...baseDescription,
			version: 1,
			defaults: {
				name: 'Json Validator',
			},
			inputs: ['main'] as NodeConnectionType[],
			outputs: [
				{ displayName: 'Valid', type: NodeConnectionType.Main },
				{ displayName: 'Invalid', type: NodeConnectionType.Main },
			],
			properties: [
				{
					displayName: `Validate data using a JSON Schema.<br />
						A valid draft-07 schema. Visit <a href='https://JSON-schema.org/draft-07/' target='_blank'>JSON-schema.org</a> to learn how to describe your validation rules in JSON Schemas.<br />
						It does make use of the errors properties of ajv-errors, learn more about it <a href='https://github.com/ajv-validator/ajv-errors'>here</a>`,
					name: 'notice',
					type: 'notice',
					default: '',
				},
				{
					displayName: 'JSON Schema',
					name: 'schema',
					type: 'json',
					required: true,
					typeOptions: {
						alwaysOpenEditWindow: true,
					},
					default: JSON.stringify(
						{
							type: 'object',
							properties: {
								foo: { type: 'integer' },
								bar: { type: 'string' },
							},
							required: ['foo'],
							additionalProperties: false,
						},
						undefined,
						2,
					),
					placeholder: '',
					description:
						'A valid draft-07 schema. Visit https://JSON-schema.org/draft-07 to learn how to describe your validation rules in JSON Schemas.',
				},
			],
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		try {
			// Schema is a node-level parameter (same for all items), so index 0 is correct
			const schema = this.getNodeParameter('schema', 0, undefined, {
				ensureType: 'json',
			}) as SchemaObject;

			const validItems: INodeExecutionData[] = [];
			const invalidItems: INodeExecutionData[] = [];

			try {
				ajv.validateSchema(schema);
				if (ajv.errors) {
					invalidItems.push({
						json: {
							error: `Invalid JSON Schema: ${ajv.errorsText(ajv.errors)}`,
						},
					});
					return [validItems, invalidItems];
				}
			} catch (error) {
				invalidItems.push({
					json: {
						error: `Invalid JSON Schema ${error}`,
					},
				});
				return [validItems, invalidItems];
			}

			// Compile schema
			const validate = ajv.compile(schema);

			// Get the input data for validation
			const items = this.getInputData();

			// Loop through each input item and validate against the schema
			for (const element of items) {
				const inputData = element.json;

				// Run validation
				const isValid = validate(inputData);

				if (!isValid) {
					invalidItems.push({
						json: {
							error: ajv.errorsText(validate.errors),
							item: inputData,
						},
					});
				} else {
					validItems.push(element);
				}
			}

			return [validItems, invalidItems];
		} catch (error) {
			if (this.continueOnFail()) {
				const items = this.getInputData();
				const invalidItems: INodeExecutionData[] = items.map((item) => ({
					json: {
						error: (error as Error).message,
						item: item.json,
					},
				}));
				return [[], invalidItems];
			}
			throw error;
		}
	}
}
