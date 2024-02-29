export function log(...message: any): void {
	const date = `[${new Date().toLocaleString()}]`;
	console.log([date, '-', ...message].join(' '));
}

export function error(...message: any): void {
	const date = `[${new Date().toLocaleString()}]`;
	console.error([date, '-', ...message].join(' '));
}
