import { CSharpFileGenerator, JavaFileGenerator, JavaScriptFileGenerator, TypeScriptFileGenerator, GoFileGenerator, Logger, DartFileGenerator, PythonFileGenerator, RustFileGenerator, TS_COMMON_PRESET, TS_JSONBINPACK_PRESET, CSHARP_DEFAULT_PRESET, CSHARP_NEWTONSOFT_SERIALIZER_PRESET, CSHARP_COMMON_PRESET, CSHARP_JSON_SERIALIZER_PRESET, KotlinFileGenerator, TS_DESCRIPTION_PRESET, PhpFileGenerator, CplusplusFileGenerator } from '@asyncapi/modelina';
import { Flags } from '@oclif/core';
import { ConvertDocumentParserAPIVersion } from '@smoya/multi-parser';
import Command from '../../base';
import { load } from '../../models/SpecificationFile';
import { formatOutput, parse, validationFlags } from '../../parser';

import type { AbstractGenerator, AbstractFileGenerator } from '@asyncapi/modelina';

enum Languages {
  typescript = 'typescript',
  csharp = 'csharp',
  golang = 'golang',
  java = 'java',
  javascript = 'javascript',
  dart = 'dart',
  python = 'python',
  rust = 'rust',
  kotlin='kotlin',
  php='php',
  cplusplus='cplusplus'
}
const possibleLanguageValues = Object.values(Languages).join(', ');

export default class Models extends Command {
  static description = 'Generates typed models';
  static args = [
    {
      name: 'language',
      description: 'The language you want the typed models generated for.',
      options: Object.keys(Languages),
      required: true
    },
    { name: 'file', description: 'Path or URL to the AsyncAPI document, or context-name', required: true },
  ];

  static flags = {
    help: Flags.help({ char: 'h' }),
    output: Flags.string({
      char: 'o',
      description: 'The output directory where the models should be written to. Omitting this flag will write the models to `stdout`.',
      required: false
    }),
    /**
     * TypeScript specific options
     */
    tsModelType: Flags.string({
      type: 'option',
      options: ['class', 'interface'],
      description: 'TypeScript specific, define which type of model needs to be generated.',
      required: false,
      default: 'class',
    }),
    tsEnumType: Flags.string({
      type: 'option',
      options: ['enum', 'union'],
      description: 'TypeScript specific, define which type of enums needs to be generated.',
      required: false,
      default: 'enum',
    }),
    tsModuleSystem: Flags.string({
      type: 'option',
      options: ['ESM', 'CJS'],
      description: 'TypeScript specific, define the module system to be used.',
      required: false,
      default: 'ESM',

    }),
    tsIncludeComments: Flags.boolean({
      description: 'TypeScript specific, if enabled add comments while generating models.',
      required: false,
      default: false,
    }),
    tsExportType: Flags.string({
      type: 'option',
      options: ['default', 'named'],
      description: 'TypeScript specific, define which type of export needs to be generated.',
      required: false,
      default: 'default',
    }),
    tsJsonBinPack: Flags.boolean({
      description: 'TypeScript specific, define basic support for serializing to and from binary with jsonbinpack.',
      required: false,
      default: false,
    }),
    tsMarshalling: Flags.boolean({
      description: 'TypeScript specific, generate the models with marshalling functions.',
      required: false,
      default: false,
    }),
    tsExampleInstance: Flags.boolean({
      description: 'Typescript specific, generate example of the model',
      required: false,
      default: false,
    }),
    /**
     * Go and Java specific package name to use for the generated models
     */
    packageName: Flags.string({
      description: 'Go, Java and Kotlin specific, define the package to use for the generated models. This is required when language is `go`, `java` or `kotlin`.',
      required: false
    }),

    /**
     * C++ and C# and PHP specific namespace to use for the generated models
     */
    namespace: Flags.string({
      description: 'C#, C++ and PHP specific, define the namespace to use for the generated models. This is required when language is `csharp`,`c++` or `php`.',
      required: false
    }),

    /**
     * C# specific options
     */
    csharpAutoImplement: Flags.boolean({
      description: 'C# specific, define whether to generate auto-implemented properties or not.',
      required: false,
      default: false
    }),
    csharpNewtonsoft: Flags.boolean({
      description: 'C# specific, generate the models with newtonsoft serialization support',
      required: false,
      default: false
    }),
    csharpArrayType: Flags.string({
      type: 'option',
      description: 'C# specific, define which type of array needs to be generated.',
      options: ['Array', 'List'],
      required: false,
      default: 'Array'
    }),
    csharpHashcode: Flags.boolean({
      description: 'C# specific, generate the models with the GetHashCode method overwritten',
      required: false,
      default: false
    }),
    csharpEqual: Flags.boolean({
      description: 'C# specific, generate the models with the Equal method overwritten',
      required: false,
      default: false
    }),
    csharpSystemJson: Flags.boolean({
      description: 'C# specific, generate the models with System.Text.Json serialization support',
      required: false,
      default: false
    }),
    ...validationFlags({ logDiagnostics: false }),
  };

  /* eslint-disable sonarjs/cognitive-complexity */
  async run() {
    const { args, flags } = await this.parse(Models);
    const { tsModelType, tsEnumType, tsIncludeComments, tsModuleSystem, tsExportType, tsJsonBinPack, tsMarshalling, tsExampleInstance, namespace, csharpAutoImplement, csharpArrayType, csharpNewtonsoft, csharpHashcode, csharpEqual, csharpSystemJson, packageName, output } = flags;
    const { language, file } = args;
    const inputFile = (await load(file)) || (await load());
    if (inputFile.isAsyncAPI3()) {
      this.error('Generate Models command does not support AsyncAPI v3 yet, please checkout https://github.com/asyncapi/modelina/issues/1376');
    }
    const { document, diagnostics ,status } = await parse(this, inputFile, flags);
    if (!document || status === 'invalid') {
      const severityErrors = diagnostics.filter((obj) => obj.severity === 0);
      this.log(`Input is not a correct AsyncAPI document so it cannot be processed.${formatOutput(severityErrors,'stylish','error')}`);
      return;
    }
    
    // Modelina, atm, is not using @asyncapi/parser@v3.x but @asyncapi/parser@v2.x, so it still uses Parser-API v1.0.0. 
    // This call converts the parsed document object using @asyncapi/parser@v3.x (Parser-API v2) to a document compatible with the Parser-API version in use in @asyncapi/parser@v2.x  (v1)
    // This is needed until https://github.com/asyncapi/modelina/issues/1493 gets fixed.
    const convertedDoc = ConvertDocumentParserAPIVersion(document.json(), 1);

    Logger.setLogger({
      info: (message) => {
        this.log(message);
      },
      debug: (message) => {
        this.debug(message);
      },
      warn: (message) => {
        this.warn(message);
      },
      error: (message) => {
        this.error(message);
      },
    });

    let fileGenerator: AbstractGenerator<any, any> & AbstractFileGenerator<any>;
    let fileOptions: any = {};
    const presets = [];
    const options = {
      marshalling: tsMarshalling,
      example: tsExampleInstance,
    };
    switch (language) {
    case Languages.typescript:
      presets.push({
        preset: TS_COMMON_PRESET,
        options
      });
      if (tsIncludeComments) {presets.push(TS_DESCRIPTION_PRESET);}
      if (tsJsonBinPack) {
        presets.push({
          preset: TS_COMMON_PRESET,
          options
        },
        TS_JSONBINPACK_PRESET);
      }
      fileGenerator = new TypeScriptFileGenerator({
        modelType: tsModelType as 'class' | 'interface',
        enumType: tsEnumType as 'enum' | 'union',
        presets
      });
      fileOptions = {
        moduleSystem: tsModuleSystem,
        exportType: tsExportType
      };
      break;
    case Languages.python:
      fileGenerator = new PythonFileGenerator();
      break;
    case Languages.rust:
      fileGenerator = new RustFileGenerator();
      break;
    case Languages.csharp:
      if (namespace === undefined) {
        throw new Error('In order to generate models to C#, we need to know which namespace they are under. Add `--namespace=NAMESPACE` to set the desired namespace.');
      }

      if (csharpAutoImplement) {
        presets.push({
          preset: CSHARP_DEFAULT_PRESET,
          options: {
            autoImplementedProperties: true
          }
        });
      }
      if (csharpNewtonsoft) {
        presets.push(CSHARP_NEWTONSOFT_SERIALIZER_PRESET);
      }
      if (csharpSystemJson) {
        presets.push(CSHARP_JSON_SERIALIZER_PRESET);
      }
      if (csharpHashcode || csharpEqual) {
        presets.push({
          preset: CSHARP_COMMON_PRESET,
          options: {
            hashCode: csharpHashcode,
            equals: csharpEqual
          }
        });
      }

      fileGenerator = new CSharpFileGenerator({
        presets,
        collectionType: csharpArrayType as 'Array' | 'List'
      });

      fileOptions = {
        namespace
      };
      break;
    case Languages.cplusplus:
      if (namespace === undefined) {
        throw new Error('In order to generate models to C++, we need to know which namespace they are under. Add `--namespace=NAMESPACE` to set the desired namespace.');
      }
      fileGenerator = new CplusplusFileGenerator({
        namespace
      });
      break;
    case Languages.golang:
      if (packageName === undefined) {
        throw new Error('In order to generate models to Go, we need to know which package they are under. Add `--packageName=PACKAGENAME` to set the desired package name.');
      }
      fileGenerator = new GoFileGenerator();
      fileOptions = {
        packageName
      };
      break;
    case Languages.java:
      if (packageName === undefined) {
        throw new Error('In order to generate models to Java, we need to know which package they are under. Add `--packageName=PACKAGENAME` to set the desired package name.');
      }
      fileGenerator = new JavaFileGenerator();
      fileOptions = {
        packageName
      };
      break;
    case Languages.javascript:
      fileGenerator = new JavaScriptFileGenerator();
      break;
    case Languages.dart:
      if (packageName === undefined) {
        throw new Error('In order to generate models to Dart, we need to know which package they are under. Add `--packageName=PACKAGENAME` to set the desired package name.');
      }
      fileGenerator = new DartFileGenerator();
      fileOptions = {
        packageName
      };
      break;
    case Languages.kotlin:
      if (packageName === undefined) {
        throw new Error('In order to generate models to Kotlin, we need to know which package they are under. Add `--packageName=PACKAGENAME` to set the desired package name.');
      }
      fileGenerator = new KotlinFileGenerator();
      fileOptions = {
        packageName
      };
      break;
    case Languages.php:
      if (namespace === undefined) {
        throw new Error('In order to generate models to PHP, we need to know which namespace they are under. Add `--namespace=NAMESPACE` to set the desired namespace.');
      }
      fileGenerator = new PhpFileGenerator();
      fileOptions = {
        namespace
      };
      break;
    default:
      throw new Error(`Could not determine generator for language ${language}, are you using one of the following values ${possibleLanguageValues}?`);
    }

    if (output) {
      const models = await fileGenerator.generateToFiles(
        convertedDoc as any,
        output,
        { ...fileOptions, });
      const generatedModels = models.map((model) => { return model.modelName; });
      this.log(`Successfully generated the following models: ${generatedModels.join(', ')}`);
      return;
    }

    const models = await fileGenerator.generateCompleteModels(
      convertedDoc as any,
      { ...fileOptions });
    const generatedModels = models.map((model) => {
      return `
## Model name: ${model.modelName}
${model.result}
`;
    });
    this.log(`Successfully generated the following models: ${generatedModels.join('\n')}`);
  }
}
