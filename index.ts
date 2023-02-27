import fs from 'fs';

import { Project, Node, CallExpression } from 'ts-morph';
import yargs_parser from 'yargs-parser';

const argv = yargs_parser(process.argv.slice(2));

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});
const sourceFiles = project.getSourceFiles();

const trimQuotes = (str: string) => {
  return str.slice(1, -1);
};

const isIntl = (node: CallExpression) => {
  const expression = node.getExpression();

  if (Node.isPropertyAccessExpression(expression)) {
    const expressionText = expression.getText();

    if (expressionText === 'intl.formatMessage') {
      return true;
    }
  }
};

const handleIntlNode = (node: Node) => {
  if (Node.isCallExpression(node) && isIntl(node)) {
    const nodeArguments = node.getArguments();

    for (const nodeArgument of nodeArguments) {
      if (Node.isObjectLiteralExpression(nodeArgument)) {
        const nodeProperties = nodeArgument.getProperties();

        for (const nodeProperty of nodeProperties) {
          if (Node.isPropertyAssignment(nodeProperty)) {
            const initializer = nodeProperty.getInitializer();
            const propertyName = nodeProperty.getName();

            if (Node.isStringLiteral(initializer) && propertyName === 'id') {
              return trimQuotes(initializer.getText());
            }
          }
        }
      }
    }
  }
};

const handleStringLiterals = (node: Node) => {
  if (Node.isStringLiteral(node)) {
    return trimQuotes(node.getText());
  }
};

const getAllStrings = () => {
  const allStrings: Set<string> = new Set();

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();

    if (filePath.includes('.tsx') || filePath.includes('.ts')) {
      sourceFile.forEachDescendant((node) => {
        if (argv.strict) {
          const nodeText = handleIntlNode(node);
          if (nodeText) {
            allStrings.add(nodeText);
          }
        } else {
          const nodeText = handleStringLiterals(node);
          if (nodeText) {
            allStrings.add(nodeText);
          }
        }
      });
    }
  }

  return allStrings;
};

const getIntlKeys = () => {
  const localeFile = fs.readFileSync('locales/en-US.json', 'utf-8');
  const localeJson = JSON.parse(localeFile);
  return Object.keys(localeJson);
};

const findUnUsedIntl = () => {
  const intlKeys = getIntlKeys();
  const allStrings = getAllStrings();

  const notUsed: string[] = [];

  const uniqueIntlMessages = Array.from(allStrings);

  for (const intlMessage of intlKeys) {
    if (!uniqueIntlMessages.includes(intlMessage)) {
      notUsed.push(intlMessage);
    }
  }

  return {
    intlKeys,
    notUsed,
  };
};

const report = (result: { intlKeys: string[]; notUsed: string[] }) => {
  console.log(
    `From ${result.intlKeys.length} messages ${result.notUsed.length} unused`
  );

  console.log('');

  for (const message of result.notUsed) {
    console.log(message);
  }
};

const result = findUnUsedIntl();

report(result);
