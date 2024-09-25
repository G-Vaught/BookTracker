export const restartPm2 = () => {
	//Kill self, pm2 should restart automatically
	process.exit();
};
