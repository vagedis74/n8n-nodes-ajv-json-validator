import { JsonValidatorV1 } from './JsonValidatorV1.node';
import { JsonValidator } from '../JsonValidator.node';
import type { INodeTypeBaseDescription, INodeExecutionData } from 'n8n-workflow';

// --- Helpers to build a mock IExecuteFunctions context ---

function createMockExecuteFunctions(opts: {
	schema: string;
	inputItems: INodeExecutionData[];
	continueOnFail?: boolean;
}): any {
	return {
		getNodeParameter: (_name: string, _index: number, _fallback: unknown, _options: unknown) => {
			return JSON.parse(opts.schema);
		},
		getInputData: () => opts.inputItems,
		continueOnFail: () => opts.continueOnFail ?? false,
	};
}

function runValidator(schema: object, inputItems: object[], opts?: { continueOnFail?: boolean }) {
	const baseDescription: INodeTypeBaseDescription = {
		displayName: 'Json Validator',
		name: 'jsonValidator',
		group: ['transform'],
		description: 'test',
		defaultVersion: 1,
	};
	const node = new JsonValidatorV1(baseDescription);

	const items: INodeExecutionData[] = inputItems.map((json) => ({ json: json as any }));

	const ctx = createMockExecuteFunctions({
		schema: JSON.stringify(schema),
		inputItems: items,
		continueOnFail: opts?.continueOnFail,
	});

	return node.execute.call(ctx);
}

// --- Tests ---

describe('JsonValidator VersionedNodeType', () => {
	it('should instantiate and expose version 1', () => {
		const node = new JsonValidator();
		expect(node).toBeDefined();
		// The versioned node should expose nodeVersions
		expect((node as any).nodeVersions[1]).toBeInstanceOf(JsonValidatorV1);
	});
});

describe('JsonValidatorV1 – node description', () => {
	it('should have correct metadata', () => {
		const base: INodeTypeBaseDescription = {
			displayName: 'Json Validator',
			name: 'jsonValidator',
			group: ['transform'],
			description: 'test',
			defaultVersion: 1,
		};
		const node = new JsonValidatorV1(base);
		expect(node.description.version).toBe(1);
		expect(node.description.inputs).toEqual(['main']);
		expect(node.description.outputs).toHaveLength(2);
		expect(node.description.properties.length).toBe(2); // notice + schema
	});
});

describe('JsonValidatorV1 – valid data', () => {
	it('should pass a single valid item through on output 0', async () => {
		const schema = {
			type: 'object',
			properties: { foo: { type: 'integer' } },
			required: ['foo'],
		};
		const result = await runValidator(schema, [{ foo: 42 }]);
		expect(result[0]).toEqual([{ json: { foo: 42 } }]);
		expect(result[1]).toEqual([]);
	});

	it('should pass multiple valid items through on output 0', async () => {
		const schema = {
			type: 'object',
			properties: { name: { type: 'string' } },
			required: ['name'],
		};
		const items = [{ name: 'Alice' }, { name: 'Bob' }];
		const result = await runValidator(schema, items);
		expect(result[0]).toHaveLength(2);
		expect(result[0][0].json).toEqual({ name: 'Alice' });
		expect(result[0][1].json).toEqual({ name: 'Bob' });
		expect(result[1]).toEqual([]);
	});

	it('should accept additional properties when not restricted', async () => {
		const schema = {
			type: 'object',
			properties: { foo: { type: 'integer' } },
		};
		const result = await runValidator(schema, [{ foo: 1, extra: 'ok' }]);
		expect(result[0][0].json).toEqual({ foo: 1, extra: 'ok' });
		expect(result[1]).toEqual([]);
	});
});

describe('JsonValidatorV1 – invalid data', () => {
	it('should return error on output 1 for wrong type', async () => {
		const schema = {
			type: 'object',
			properties: { foo: { type: 'integer' } },
			required: ['foo'],
		};
		const result = await runValidator(schema, [{ foo: 'not a number' }]);
		expect(result[0]).toEqual([]);
		expect(result[1]).toHaveLength(1);
		expect(result[1][0].json).toHaveProperty('error');
		expect(result[1][0].json.error).toContain('foo');
		expect(result[1][0].json).toHaveProperty('item');
	});

	it('should return error on output 1 for missing required field', async () => {
		const schema = {
			type: 'object',
			properties: { foo: { type: 'integer' } },
			required: ['foo'],
		};
		const result = await runValidator(schema, [{}]);
		expect(result[0]).toEqual([]);
		expect(result[1][0].json).toHaveProperty('error');
		expect(result[1][0].json.error).toContain('foo');
	});

	it('should return error on output 1 for additional properties when forbidden', async () => {
		const schema = {
			type: 'object',
			properties: { foo: { type: 'integer' } },
			additionalProperties: false,
		};
		const result = await runValidator(schema, [{ foo: 1, bar: 'extra' }]);
		expect(result[0]).toEqual([]);
		expect(result[1][0].json).toHaveProperty('error');
		expect(result[1][0].json.error).toContain('additional properties');
	});

	it('should process all items and route valid/invalid to correct outputs', async () => {
		const schema = {
			type: 'object',
			properties: { x: { type: 'number' } },
			required: ['x'],
		};
		const items = [{ x: 1 }, { x: 'bad' }, { x: 3 }];
		const result = await runValidator(schema, items);
		// Valid items on output 0
		expect(result[0]).toHaveLength(2);
		expect(result[0][0].json).toEqual({ x: 1 });
		expect(result[0][1].json).toEqual({ x: 3 });
		// Invalid item on output 1
		expect(result[1]).toHaveLength(1);
		expect(result[1][0].json).toHaveProperty('error');
		expect(result[1][0].json.item).toEqual({ x: 'bad' });
	});

	it('should route all items to output 1 when all are invalid', async () => {
		const schema = {
			type: 'object',
			properties: { x: { type: 'number' } },
			required: ['x'],
		};
		const items = [{ x: 'a' }, { x: 'b' }];
		const result = await runValidator(schema, items);
		expect(result[0]).toEqual([]);
		expect(result[1]).toHaveLength(2);
		expect(result[1][0].json.item).toEqual({ x: 'a' });
		expect(result[1][1].json.item).toEqual({ x: 'b' });
	});
});

describe('JsonValidatorV1 – invalid schema', () => {
	it('should return error on output 1 for a schema with invalid type keyword', async () => {
		const schema = {
			type: 'not-a-type',
		};
		const result = await runValidator(schema, [{ anything: true }]);
		expect(result[0]).toEqual([]);
		expect(result[1]).toHaveLength(1);
		expect(result[1][0].json).toHaveProperty('error');
		expect((result[1][0].json.error as string).toLowerCase()).toContain('schema');
	});

	it('should return error on output 1 for completely broken schema structure', async () => {
		const schema = {
			type: 'object',
			properties: 'this-should-be-an-object',
		};
		const result = await runValidator(schema, [{}]);
		expect(result[0]).toEqual([]);
		expect(result[1]).toHaveLength(1);
		expect(result[1][0].json).toHaveProperty('error');
	});
});

describe('JsonValidatorV1 – ajv-formats support', () => {
	it('should validate email format', async () => {
		const schema = {
			type: 'object',
			properties: {
				email: { type: 'string', format: 'email' },
			},
			required: ['email'],
		};
		const valid = await runValidator(schema, [{ email: 'test@example.com' }]);
		expect(valid[0][0].json).toEqual({ email: 'test@example.com' });
		expect(valid[1]).toEqual([]);

		const invalid = await runValidator(schema, [{ email: 'not-an-email' }]);
		expect(invalid[0]).toEqual([]);
		expect(invalid[1][0].json).toHaveProperty('error');
	});

	it('should validate date format', async () => {
		const schema = {
			type: 'object',
			properties: {
				d: { type: 'string', format: 'date' },
			},
			required: ['d'],
		};
		const valid = await runValidator(schema, [{ d: '2024-01-15' }]);
		expect(valid[0][0].json).toEqual({ d: '2024-01-15' });
		expect(valid[1]).toEqual([]);

		const invalid = await runValidator(schema, [{ d: 'not-a-date' }]);
		expect(invalid[0]).toEqual([]);
		expect(invalid[1][0].json).toHaveProperty('error');
	});

	it('should validate uri format', async () => {
		const schema = {
			type: 'object',
			properties: {
				url: { type: 'string', format: 'uri' },
			},
		};
		const valid = await runValidator(schema, [{ url: 'https://example.com' }]);
		expect(valid[0][0].json).toEqual({ url: 'https://example.com' });
		expect(valid[1]).toEqual([]);

		const invalid = await runValidator(schema, [{ url: 'not a uri' }]);
		expect(invalid[0]).toEqual([]);
		expect(invalid[1][0].json).toHaveProperty('error');
	});
});

describe('JsonValidatorV1 – ajv-errors (custom error messages)', () => {
	it('should return custom errorMessage from schema', async () => {
		const schema = {
			type: 'object',
			properties: {
				age: { type: 'integer', minimum: 0 },
			},
			required: ['age'],
			errorMessage: {
				required: {
					age: 'Age is required',
				},
				properties: {
					age: 'Age must be a non-negative integer',
				},
			},
		};
		const missingResult = await runValidator(schema, [{}]);
		expect(missingResult[1][0].json.error).toContain('Age is required');

		const badTypeResult = await runValidator(schema, [{ age: -1 }]);
		expect(badTypeResult[1][0].json.error).toContain('Age must be a non-negative integer');
	});
});

describe('JsonValidatorV1 – allErrors mode', () => {
	it('should report multiple errors at once', async () => {
		const schema = {
			type: 'object',
			properties: {
				a: { type: 'integer' },
				b: { type: 'integer' },
			},
			required: ['a', 'b'],
		};
		const result = await runValidator(schema, [{ a: 'wrong', b: 'wrong' }]);
		const errorMsg = result[1][0].json.error as string;
		// With allErrors, both fields should be mentioned
		expect(errorMsg).toContain('a');
		expect(errorMsg).toContain('b');
	});
});

describe('JsonValidatorV1 – complex schemas', () => {
	it('should validate nested objects', async () => {
		const schema = {
			type: 'object',
			properties: {
				user: {
					type: 'object',
					properties: {
						name: { type: 'string' },
						age: { type: 'integer' },
					},
					required: ['name'],
				},
			},
			required: ['user'],
		};
		const valid = await runValidator(schema, [{ user: { name: 'Alice', age: 30 } }]);
		expect(valid[0][0].json).toEqual({ user: { name: 'Alice', age: 30 } });
		expect(valid[1]).toEqual([]);

		const invalid = await runValidator(schema, [{ user: { age: 30 } }]);
		expect(invalid[0]).toEqual([]);
		expect(invalid[1][0].json).toHaveProperty('error');
	});

	it('should validate arrays', async () => {
		const schema = {
			type: 'object',
			properties: {
				tags: {
					type: 'array',
					items: { type: 'string' },
					minItems: 1,
				},
			},
			required: ['tags'],
		};
		const valid = await runValidator(schema, [{ tags: ['a', 'b'] }]);
		expect(valid[0][0].json).toEqual({ tags: ['a', 'b'] });
		expect(valid[1]).toEqual([]);

		const empty = await runValidator(schema, [{ tags: [] }]);
		expect(empty[0]).toEqual([]);
		expect(empty[1][0].json).toHaveProperty('error');

		const wrongType = await runValidator(schema, [{ tags: [1, 2] }]);
		expect(wrongType[0]).toEqual([]);
		expect(wrongType[1][0].json).toHaveProperty('error');
	});

	it('should validate enum values', async () => {
		const schema = {
			type: 'object',
			properties: {
				status: { type: 'string', enum: ['active', 'inactive'] },
			},
			required: ['status'],
		};
		const valid = await runValidator(schema, [{ status: 'active' }]);
		expect(valid[0][0].json).toEqual({ status: 'active' });
		expect(valid[1]).toEqual([]);

		const invalid = await runValidator(schema, [{ status: 'deleted' }]);
		expect(invalid[0]).toEqual([]);
		expect(invalid[1][0].json).toHaveProperty('error');
	});

	it('should validate pattern constraint', async () => {
		const schema = {
			type: 'object',
			properties: {
				zip: { type: 'string', pattern: '^[0-9]{5}$' },
			},
			required: ['zip'],
		};
		const valid = await runValidator(schema, [{ zip: '12345' }]);
		expect(valid[0][0].json).toEqual({ zip: '12345' });
		expect(valid[1]).toEqual([]);

		const invalid = await runValidator(schema, [{ zip: 'abcde' }]);
		expect(invalid[0]).toEqual([]);
		expect(invalid[1][0].json).toHaveProperty('error');
	});
});

describe('JsonValidatorV1 – edge cases', () => {
	it('should handle empty object with permissive schema', async () => {
		const schema = { type: 'object' };
		const result = await runValidator(schema, [{}]);
		expect(result[0][0].json).toEqual({});
		expect(result[1]).toEqual([]);
	});

	it('should handle empty input items array', async () => {
		const schema = { type: 'object' };
		const result = await runValidator(schema, []);
		expect(result[0]).toEqual([]);
		expect(result[1]).toEqual([]);
	});

	it('should validate boolean schema values', async () => {
		const schema = {
			type: 'object',
			properties: {
				flag: { type: 'boolean' },
			},
			required: ['flag'],
		};
		const valid = await runValidator(schema, [{ flag: true }]);
		expect(valid[0][0].json).toEqual({ flag: true });
		expect(valid[1]).toEqual([]);

		const invalid = await runValidator(schema, [{ flag: 'true' }]);
		expect(invalid[0]).toEqual([]);
		expect(invalid[1][0].json).toHaveProperty('error');
	});

	it('should validate null type', async () => {
		const schema = {
			type: 'object',
			properties: {
				value: { type: 'null' },
			},
			required: ['value'],
		};
		const valid = await runValidator(schema, [{ value: null }]);
		expect(valid[0][0].json).toEqual({ value: null });
		expect(valid[1]).toEqual([]);

		const invalid = await runValidator(schema, [{ value: 0 }]);
		expect(invalid[0]).toEqual([]);
		expect(invalid[1][0].json).toHaveProperty('error');
	});
});

describe('JsonValidatorV1 – continueOnFail', () => {
	it('should return error items on output 1 when continueOnFail is enabled and unexpected error occurs', async () => {
		const baseDescription: INodeTypeBaseDescription = {
			displayName: 'Json Validator',
			name: 'jsonValidator',
			group: ['transform'],
			description: 'test',
			defaultVersion: 1,
		};
		const node = new JsonValidatorV1(baseDescription);

		const items: INodeExecutionData[] = [{ json: { foo: 1 } }, { json: { foo: 2 } }];

		const ctx = {
			getNodeParameter: () => {
				throw new Error('Unexpected runtime error');
			},
			getInputData: () => items,
			continueOnFail: () => true,
		};

		const result = await node.execute.call(ctx as any);
		expect(result[0]).toEqual([]);
		expect(result[1]).toHaveLength(2);
		expect(result[1][0].json.error).toBe('Unexpected runtime error');
		expect(result[1][0].json.item).toEqual({ foo: 1 });
		expect(result[1][1].json.error).toBe('Unexpected runtime error');
		expect(result[1][1].json.item).toEqual({ foo: 2 });
	});

	it('should throw when continueOnFail is disabled and unexpected error occurs', async () => {
		const baseDescription: INodeTypeBaseDescription = {
			displayName: 'Json Validator',
			name: 'jsonValidator',
			group: ['transform'],
			description: 'test',
			defaultVersion: 1,
		};
		const node = new JsonValidatorV1(baseDescription);

		const ctx = {
			getNodeParameter: () => {
				throw new Error('Unexpected runtime error');
			},
			getInputData: () => [],
			continueOnFail: () => false,
		};

		await expect(node.execute.call(ctx as any)).rejects.toThrow('Unexpected runtime error');
	});
});
