import catalogJson from '../data/catalog.json';
import { parseCatalog } from './catalog';

export const CATALOG = parseCatalog(catalogJson);
