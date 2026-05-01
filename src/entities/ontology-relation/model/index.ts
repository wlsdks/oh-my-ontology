export type {
  OntologyRelation,
  OntologyRelationInput,
  OntologyRelationCategory,
  RelationCardinality,
} from './types';
export {
  DEFAULT_ONTOLOGY_RELATIONS,
  isOntologyRelationId,
  isRelationApplicable,
} from './defaults';
export { fromFirestore, toFirestore } from './mapper';
