import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJSDoc from 'swagger-jsdoc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VietQuest API',
      version: '1.0.0',
      description: 'API quản lý Di sản Việt Nam'
    },
    servers: [{ url: '/api' }],
    components: {
      schemas: {
        Heritage: {
          type: 'object',
          required: ['hid','ward_codename','name','type','type_code','level','code_level'],
          properties: {
            hid: { type: 'string', example: 'hn-bd-0001' },
            ward_codename: { type: 'string', example: 'phuong_phuoc_my' },
            name: { type: 'string', example: 'Di tích A' },
            type: { type: 'string', enum: ['di_san_van_hoa_vat_the','di_san_van_hoa_phi_vat_the','di_san_thien_nhien'] },
            type_code: { type: 'integer', enum: [1,2,3], example: 1 },
            wiki_link: { type: 'string', format: 'uri' },
            coordinate: {
              type: 'object',
              properties: {
                type: { type: 'string', example: 'Point' },
                coordinates: { type: 'array', items: { type: 'number' }, description: '[lng, lat]', example: [105.836, 21.036] }
              }
            },
            level: {
              type: 'string',
              enum: ['cap_tinh','cap_quoc_gia','cap_dac_biet','di_san_the_gioi','ds_phi_vat_the_dai_dien','ky_uc_the_gioi','khu_du_tru_sinh_quyen','cong_vien_dia_chat_toan_cau']
            },
            code_level: { type: 'integer', enum: [1,2,3,4,5,6,7,8], example: 2 },
            img: { type: 'string', format: 'uri' },
            photo_library: { type: 'array', items: { type: 'string', format: 'uri' } },
            Summary: { type: 'string' },
            history: { type: 'string' },
            Heritage: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  // QUAN TRỌNG: Cho swagger-jsdoc biết nơi chứa @openapi JSDoc
  apis: [
    path.join(__dirname, '../routes/*.js')
  ]
});
