import { GrammarManager, MmpRule } from '../grammar/GrammarManager';
import { InternalNode } from '../grammar/ParseNode';
import { LabeledStatement } from '../mm/LabeledStatement';
import { MmParser } from '../mm/MmParser';
import { GrammarManagerForThread, IMmpRuleForThread } from '../parseNodesCreatorThread/GrammarManagerForThread';
import { ParseNodeForThread } from '../parseNodesCreatorThread/ParseNodeForThread';
import { addParseNodes, creaParseNodesInANewThread, createLabelToFormulaMap, createLabelToParseNodeForThreadMap, defaultProgressCallback, postDone, postLog, postProgress } from '../parseNodesCreatorThread/ParseNodesCreator';
import { eqeq1iMmParser } from './GlobalForTest.test';
import * as worker_threads from 'worker_threads';


function buildParseNodesSimulated(mmParser: MmParser) {
	const labelToFormulaMap: Map<string, string> = createLabelToFormulaMap(mmParser);
	const mmpRulesForThread: IMmpRuleForThread[] =
		GrammarManagerForThread.convertMmpRules(<MmpRule[]>mmParser.grammar.rules);
	const labelToParseNodeForThreadMap: Map<string, ParseNodeForThread> = createLabelToParseNodeForThreadMap(labelToFormulaMap, mmpRulesForThread);
	addParseNodes(labelToParseNodeForThreadMap, mmParser.labelToStatementMap);
}

describe("ParseNodesCreator.ts", () => {

	beforeEach(() => {
		expect(worker_threads.parentPort).toBeNull();
	});

	afterEach(() => {
		(worker_threads.parentPort as unknown) = null;
	});

	test("Simulate working thread serialization, deserialization", () => {
		const postMessage = jest.fn();
		(worker_threads.parentPort as unknown) = {postMessage};

		const mmParser: MmParser = eqeq1iMmParser;

		mmParser.createParseNodesForAssertionsSync();
		const dummyNode: InternalNode = new InternalNode('dummy', 'dummy', []);
		const labelToParseNode: Map<string, InternalNode> = new Map<string, InternalNode>();
		mmParser.labelToStatementMap.forEach((labeledStatement: LabeledStatement, label: string) => {
			if (MmParser.isParsable(labeledStatement)) {
				labelToParseNode.set(label, labeledStatement.parseNode!);
				labeledStatement.setParseNode(dummyNode);

			}
		});
		buildParseNodesSimulated(mmParser);
		const parseNode: InternalNode = labelToParseNode.get('axext3')!;
		const parseNodeSimulated: InternalNode = mmParser.labelToStatementMap.get('axext3')!.parseNode!;
		const areEqual: boolean = GrammarManager.areParseNodesEqual(parseNode, parseNodeSimulated);
		expect(areEqual).toBeTruthy();

		const messages = postMessage.mock.calls.map(call => call[0]);
		const logMessages = messages.filter(message => message.kind === 'log');
		const progressMessages = messages.filter(message => message.kind === 'progress');
		const doneMessages = messages.filter(message => message.kind === 'done');

		expect(logMessages).toEqual([
			{
				kind: 'log',
				text: 'labelToParseNodeForThreadMap.size = 391'
			},
			{
				kind: 'log',
				text: 'formulaToParseNodeForThreadCache.size = 181'
			}
		]);

		expect(progressMessages.length).toEqual(391);
		expect(doneMessages).toEqual([]);
	});

	describe("postProgress", () => {
		it("posts a progress message", () => {
			const postMessage = jest.fn();
			(worker_threads.parentPort as unknown) = {postMessage};
			postProgress(7, 9);
			expect(postMessage).toHaveBeenCalledWith({kind: 'progress', index: 7, count: 9});
		});

		it(`doesn't fail if there is no parentPort`, () => {
			expect(worker_threads.parentPort).toBeNull();
			postProgress(7, 9);
		});
	});

	describe("postLog", () => {
		it("posts a log message", () => {
			const postMessage = jest.fn();
			(worker_threads.parentPort as unknown) = {postMessage};
			postLog('a log message');
			expect(postMessage).toHaveBeenCalledWith({kind: 'log', text: 'a log message'});
		});

		it(`doesn't fail if there is no parentPort`, () => {
			expect(worker_threads.parentPort).toBeNull();
			postLog('a log message');
		});
	});

	describe("postDone", () => {
		const labelToParseNodeForThreadMap = new Map<string, ParseNodeForThread>();

		it("posts a done message", () => {
			const postMessage = jest.fn();
			(worker_threads.parentPort as unknown) = {postMessage};
			postDone(labelToParseNodeForThreadMap);
			expect(postMessage).toHaveBeenCalledWith({kind: 'done', labelToParseNodeForThreadMap});
		});

		it(`doesn't fail if there is no parentPort`, () => {
			expect(worker_threads.parentPort).toBeNull();
			postDone(labelToParseNodeForThreadMap);
		});
	});

	describe("creaParseNodesInANewThread", () => {
		const origWorker = worker_threads.Worker;

		afterEach(() => {
			(worker_threads.Worker as unknown) = origWorker;
		});

		it ("resolves when it recieves a MessageDone", async () => {
			let onMessage: any = undefined;

			(worker_threads.Worker as unknown) = jest.fn().mockImplementation(() => {
				return {
					on: (eventName: string, fn: unknown) => {
						if (eventName === 'message') {
							onMessage = fn;
						}
					}
				};
			});

			const promise = creaParseNodesInANewThread(eqeq1iMmParser, defaultProgressCallback);
			const labelToParseNodeForThreadMap = new Map<string, ParseNodeForThread>();
			onMessage({kind: 'done', labelToParseNodeForThreadMap});
			await expect(promise).resolves.toBeUndefined();
		});
	});
});
