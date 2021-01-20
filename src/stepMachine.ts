import { Machine, sendParent } from 'xstate';

interface StepMachineFactoryProps {
	id: string;
	onReady?: () => Promise<void>;
	onProcess?: () => Promise<any>;
	onComplete?: () => Promise<void>;
	onInvalid?: () => Promise<void>;
	onOutdated?: () => Promise<void>;
	onLocked?: () => Promise<void>;
}

export const stepMachineFactory = (props: StepMachineFactoryProps) => {
	const { id, onProcess: process = async () => void 0 } = props;

	return Machine({
		id,
		initial: 'initial',
		states: {
			initial: {
				on: {
					START: 'ready',
				},
			},
			ready: {
				on: {
					PROCESS: 'processing',
					TOUCHED: 'progress',
				},
			},
			progress: {
				on: {
					PROCESS: 'processing',
					RESET: 'ready',
				},
			},
			processing: {
				invoke: {
					src: process,
					onDone: {
						target: 'complete',
					},
					onError: {
						target: 'invalid',
					},
				},
				on: {},
			},
			complete: {
				entry: sendParent({ type: 'STEP_COMPLETE', id }),
				on: {
					OUTDATED: 'outdated',
					PROCESS: 'processing',
					TOUCHED: 'progress',
				},
			},
			invalid: {
				entry: sendParent({ type: 'STEP_INVALID', id }),
				on: {
					OUTDATED: 'outdated',
					PROCESS: 'processing',
					TOUCHED: 'progress',
				},
			},
			outdated: {
				entry: sendParent({ type: 'STEP_OUTDATED', id }),
				on: {
					PROCESS: 'processing',
					TOUCHED: 'progress',
				},
			},
			locked: {
				type: 'final',
			},
		},
	});
};
