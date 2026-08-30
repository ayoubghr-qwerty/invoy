import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dbQuery, dbExecute } from '../utils/db';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [activeCompanyId, setActiveCompanyId] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const rows = await dbQuery('SELECT * FROM companies WHERE active = 1 ORDER BY id');
      setCompanies(rows);
      if (rows.length > 0 && !rows.find(c => c.id === activeCompanyId)) {
        setActiveCompanyId(rows[0].id);
      }
    } catch (e) {
      console.error('Failed to load companies:', e);
    }
    setLoading(false);
  }, [activeCompanyId]);

  async function addCompany(name) {
    await dbExecute('INSERT INTO companies (name) VALUES (?)', [name]);
    await loadCompanies();
  }

  async function updateCompany(id, data) {
    await dbExecute(
      'UPDATE companies SET name = ?, adresse = ?, telephone = ?, nif = ?, nis = ?, agrement = ?, rc = ? WHERE id = ?',
      [data.name, data.adresse, data.telephone, data.nif, data.nis, data.agrement, data.rc, id]
    );
    await loadCompanies();
  }

  async function deleteCompany(id) {
    if (id === 1) return;
    await dbExecute('UPDATE companies SET active = 0 WHERE id = ?', [id]);
    if (activeCompanyId === id) {
      setActiveCompanyId(1);
    }
    await loadCompanies();
  }

  const activeCompany = companies.find(c => c.id === activeCompanyId) || companies[0];

  return (
    <CompanyContext.Provider value={{
      companies, activeCompany, activeCompanyId, setActiveCompanyId,
      addCompany, updateCompany, deleteCompany, loading
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
