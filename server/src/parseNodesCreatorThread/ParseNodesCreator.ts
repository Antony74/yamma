import { Grammar } from 'nearley';
import { isMainThread, parentPort, Worker, workerData } from 'worker_threads';
import { MmpRule } from '../grammar/GrammarManager';
import { MmLexer } from '../grammar/MmLexer';
import { InternalNode, ParseNode } from '../grammar/ParseNode';
import { LabeledStatement } from '../mm/LabeledStatement';
import { MmParser } from '../mm/MmParser';
import { concatWithSpaces, notifyProgress } from '../mm/Utils';
import { WorkingVars } from '../mmp/WorkingVars';
import { GrammarManagerForThread, IMmpRuleForThread } from './GrammarManagerForThread';
import { ParseNodeForThread, ParseNodeForThreadConverter } from './ParseNodeForThread';


//#region CHILD THREAD
if (!isMainThread) {
	const { labelToFormulaMap, mmpRulesForThread }: { labelToFormulaMap: Map<string, string>, mmpRulesForThread: IMmpRuleForThread[] } = workerData;

	console.log('I am the worker process!!!!!!!!!');
	console.log('Worker thread!!!!: labelToFormulaMap.size = ' + labelToFormulaMap);
	const labelToParseNodeForThreadMap: Map<string, ParseNodeForThread> =
		createLabelToParseNodeForThreadMap(labelToFormulaMap, mmpRulesForThread);
	parentPort!.postMessage(labelToParseNodeForThreadMap);
}

//#region createLabelToParseNodeForThreadMap

function createGrammar(mmpRulesForThread: IMmpRuleForThread[], workingVars: WorkingVars): Grammar {
	const mmpRules: MmpRule[] = GrammarManagerForThread.convertMmpRulesForThread(mmpRulesForThread);
	const grammar: Grammar = new Grammar(mmpRules);
	grammar.lexer = new MmLexer(workingVars);
	return grammar;
}

function createParseNodeForThread(formula: string, grammar:
	Grammar, workingVars: WorkingVars): ParseNodeForThread | undefined {
	let parseNodeForThread: ParseNodeForThread | undefined;
	const parseNode: ParseNode | undefined = LabeledStatement.parseString(formula, grammar, workingVars);
	if (parseNode != undefined)
		parseNodeForThread = ParseNodeForThreadConverter.convertParseNode(parseNode);
	return parseNodeForThread;
}
function createLabelToParseNodeForThreadMap(labelToFormulaMap: Map<string, string>,
	mmpRulesForThread: IMmpRuleForThread[]): Map<string, ParseNodeForThread> {
	const labelToParseNodeForThreadMap: Map<string, ParseNodeForThread> = new Map<string, ParseNodeForThread>();
	const workingVars: WorkingVars = new WorkingVars(new Map<string, string>());
	const grammar: Grammar = createGrammar(mmpRulesForThread, workingVars);
	// const grammar: Grammar = createGrammar()
	labelToFormulaMap.forEach((formula: string, label: string) => {
		const parseNodeForThread: ParseNodeForThread | undefined = createParseNodeForThread(formula, grammar, workingVars);
		if (parseNodeForThread != undefined)
			labelToParseNodeForThreadMap.set(label, parseNodeForThread);
	});
	return labelToParseNodeForThreadMap;
}
//#endregion createLabelToParseNodeForThreadMap

//#endregion CHILD THREAD

//TODO1
//#region creaParseNodesInANewThread
function createLabelToFormulaMap(mmParser: MmParser): Map<string, string> {
	const labelToStatementMap: Map<string, LabeledStatement> = mmParser.labelToStatementMap;
	const labelToFormulaMap: Map<string, string> = new Map<string, string>();
	labelToStatementMap.forEach((labeledStatement: LabeledStatement) => {
		if (MmParser.isParsable(labeledStatement)) {
			const formula: string = concatWithSpaces(labeledStatement.formula);
			labelToFormulaMap.set(labeledStatement.Label, formula);
		}
	});
	return labelToFormulaMap;
}

function addParseNodes(labelToParseNodeForThreadMap: Map<string, ParseNodeForThread>,
	labelToStatementMap: Map<string, LabeledStatement>) {
	let i = 0;
	labelToParseNodeForThreadMap.forEach((parseNodeForThread: ParseNodeForThread, label: string) => {
		notifyProgress(i++, labelToParseNodeForThreadMap.size);
		const parseNode: ParseNode = ParseNodeForThreadConverter.convertParseNodeForThread(parseNodeForThread);
		const labeledStatement: LabeledStatement | undefined = labelToStatementMap.get(label);
		if (labeledStatement != undefined)
			labeledStatement.setParseNode(<InternalNode>parseNode);
	});

}

export function creaParseNodesInANewThread(mmParser: MmParser): void {
	// This code is executed in the main thread and not in the worker.
	const labelToFormulaMap: Map<string, string> = createLabelToFormulaMap( mmParser );
	const mmpRulesForThread: IMmpRuleForThread[] =
		GrammarManagerForThread.convertMmpRules(<MmpRule[]>mmParser.grammar.rules);

	console.log('I am the Main thread!!!!!!!: labelToFormulaMap.size = ' + labelToFormulaMap.size);

	// Create the worker.
	const workerFileName: string = __filename.replace('src', 'out').replace('.ts', '.js');
	// const worker = new Worker(__filename);
	// let workerData: any = { parseNode: labelToStatementMap };
	const workerData = { labelToFormulaMap: labelToFormulaMap, mmpRulesForThread: mmpRulesForThread };
	const worker = new Worker(workerFileName, { workerData: workerData });
	// Listen for messages from the worker and print them.
	worker.on('message', (labelToParseNodeForThreadMap: Map<string, ParseNodeForThread>) => {
		console.log('I am back to the Main thread!!!!!!!');
		addParseNodes(labelToParseNodeForThreadMap, mmParser.labelToStatementMap);
		mmParser.areAllParseNodesComplete = true;
	});
}
//#endregion creaParseNodesInANewThread


// function createParseNodes(): any {
// 	GlobalState.lastMmpParser!.labelToStatementMap.forEach((labeledStatement: LabeledStatement) => {
// 		if (labeledStatement instanceof EHyp ||
// 			labeledStatement instanceof AssertionStatement && !GrammarManager.isSyntaxAxiom2(labeledStatement)) {
// 			// if the parseNode is undefined, it will create it
// 			labeledStatement.parseNode;
// 		}
// 	});
// }
