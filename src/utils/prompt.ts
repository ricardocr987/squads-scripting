/**
 * Shared prompt utilities for user interactions
 */

export async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

export async function promptYesNo(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

export async function promptChoice(question: string, choices: string[]): Promise<string> {
  const choiceText = choices.map((choice, index) => `${index + 1}. ${choice}`).join('\n');
  const answer = await prompt(`${question}\n${choiceText}\nEnter your choice (1-${choices.length}): `);
  const choiceIndex = parseInt(answer) - 1;
  
  if (choiceIndex < 0 || choiceIndex >= choices.length) {
    throw new Error(`Invalid choice. Please enter a number between 1 and ${choices.length}.`);
  }
  
  return choices[choiceIndex] as string;
}

export async function promptWalletChoice(question: string): Promise<'manager' | 'voter1' | 'voter2'> {
  const answer = await prompt(`${question} (1 for manager, 2 for voter1, 3 for voter2): `);
  
  if (answer === '1') {
    return 'manager';
  } else if (answer === '2') {
    return 'voter1';
  } else if (answer === '3') {
    return 'voter2';
  } else {
    throw new Error('Invalid choice. Please enter 1, 2, or 3.');
  }
}
