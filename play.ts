import * as fs from 'fs/promises';
import { MmtSaver } from './server/src/mmt/MmtSaver';

const main = async () => {
	const text = await fs.readFile('/set.mm/demo0.mm', {encoding: 'utf-8'});

	console.log(text);

	// const mmtSaver: MmtSaver = new MmtSaver(
    //     'demo0.mm',
    //     text,
    //     GlobalState.mmParser
    // );
    // mmtSaver.saveMmt();
};

main();
