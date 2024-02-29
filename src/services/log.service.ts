const log = console.log;

console.log = function () {
	const first_parameter = arguments[0];
	const other_parameters = Array.prototype.slice.call(arguments, 1);

	log.apply(
		console,
		[
			'[' +
				new Date().toLocaleString('en-US', {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
					hour12: false
				}) +
				']',
			first_parameter
		].concat(other_parameters)
	);
};
