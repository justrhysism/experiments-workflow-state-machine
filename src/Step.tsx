import React from 'react';
import cc from 'classcat';

export type StepState =
	| 'initial'
	| 'ready'
	| 'progress'
	| 'processing'
	| 'complete'
	| 'invalid'
	| 'outdated'
	| 'locked';

export interface StepProps {
	number?: number;
	label: string;
	state?: StepState;
	active?: boolean;
	disabled?: boolean;
	onClick?: () => void;
}

const Step: React.FC<StepProps> = (props) => {
	const { number, label, active, disabled: disabledProp, state = 'initial', onClick, children } = props;
	const disabled = disabledProp || state === 'initial';

	const handleClick = () => {
		if (active || disabled) return;
		onClick?.();
	};

	return (
		<div className={cc(['step', { 'is-disabled': disabled }, `is-${state}`])}>
			<div className="step__spot" onClick={handleClick}>
				<div className="step__spot-graphic" onClick={handleClick}>
					{number}
				</div>
				{active && <div className="step__active-arrow">➔</div>}
				{active && <div className="step__actions">{children}</div>}
			</div>
			<div className="step__label">{label}</div>
			<div className="step__sublabel">{state}</div>
		</div>
	);
};

export default Step;
