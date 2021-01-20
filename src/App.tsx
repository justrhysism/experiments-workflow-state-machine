import * as React from 'react';
import './styles.css';
import { Machine, assign, spawn } from 'xstate';
import { useMachine } from '@xstate/react';
import { stepMachineFactory } from './stepMachine';
import Step from './Step';
import { useWorkflowMachine, WorkflowStepDefinition } from './workflow/workflow-factory';

// interface Context {
// 	steps: {
// 		details: null | ActorRef,
// 		initiatives: null,
// 		schedule: null,
// 		variations: null,
// 		run: null,
// 		analyse: null,
// 		publish: null
// 	}
// }

const StateControls: React.FC<{ stepRefs: any; stepRefId: string }> = ({ stepRefs, stepRefId }) =>
	stepRefs[stepRefId].state.nextEvents
		.filter((event: string) => !event.includes('done') && !event.includes('error'))
		.map((event: string) => (
			<button
				key={event}
				className="action"
				onClick={() => {
					stepRefs[stepRefId].send(event);
				}}
			>
				{event}
			</button>
		));

// TEMP
const chanceInTen = (chance: number) => Math.random() * 10 < chance - 0.1;

const processStep = () =>
	new Promise<void>((resolve, reject) => setTimeout(() => (chanceInTen(7) ? resolve() : reject()), 1000));

const steps: WorkflowStepDefinition[] = [
	{ id: 'details', process: processStep },
	{ id: 'initiatives', process: processStep, deps: ['details'] },
	{ id: 'schedule', process: processStep, deps: ['initiatives'] },
	{ id: 'variations', process: processStep, deps: ['initiatives'] },
	{ id: 'run', process: processStep, deps: ['details', 'schedule', 'variations'] },
];

export default function App() {
	const [current, send] = useWorkflowMachine({ steps });
	console.log(current);
	const { currentStepIndex: currentStep, ...stepRefs } = current.context;

	const handleRunClick = (action: string) => () => {
		send(action);
	};

	const handleStepClick = (step: string) => () => {
		send('currentStep.UPDATE', { value: step });
	};

	return (
		<div className="App">
			<div>
				<h1>Workflow</h1>
			</div>

			<div className="button-container">
				<button onClick={handleRunClick(current.value === 'idle' ? 'RUN' : 'STOP')}>
					{current.value === 'idle' ? 'Run' : 'Stop'}
				</button>
			</div>

			<div>
				<Step
					label="Set Details"
					onClick={handleStepClick('details')}
					active={currentStep === 0}
					state={stepRefs.detailsRef.state.value}
				>
					<StateControls stepRefs={stepRefs} stepRefId="detailsRef" />
				</Step>

				<Step
					label="Add Initiatives"
					onClick={handleStepClick('initiatives')}
					active={currentStep === 1}
					state={stepRefs.initiativesRef.state.value}
				>
					<StateControls stepRefs={stepRefs} stepRefId="initiativesRef" />
				</Step>
				<Step
					label="Add Schedule"
					onClick={handleStepClick('schedule')}
					active={currentStep === 2}
					state={stepRefs.scheduleRef.state.value}
				>
					<StateControls stepRefs={stepRefs} stepRefId="scheduleRef" />
				</Step>
				<Step
					label="Configure Variations"
					onClick={handleStepClick('variations')}
					active={currentStep === 3}
					state={stepRefs.variationsRef.state.value}
				>
					<StateControls stepRefs={stepRefs} stepRefId="variationsRef" />
				</Step>
				<Step
					label="Run Simulation"
					onClick={handleStepClick('run')}
					active={currentStep === 4}
					state={stepRefs.runRef.state.value}
				>
					<StateControls stepRefs={stepRefs} stepRefId="runRef" />
				</Step>
				{/* <Step label="Analyse Simulation" disabled />
				<Step label="Publish" disabled /> */}
			</div>
		</div>
	);
}
