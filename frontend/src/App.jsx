import React, { useState, useEffect } from 'react';

const API_BASE = 'https://findit-q2hk.onrender.com/api/items';

const CATEGORIES = [
  'Electronics',
  'ID Cards & Wallets',
  'Books & Notes',
  'Keys',
  'Accessories & Bags',
  'Water Bottles & Lunchboxes',
  'Other',
];

const LOCATIONS = [
  'Main Library',
  'Cafeteria / Food Court',
  'CSE Lab Block',
  'Main Auditorium',
  'Sports Complex',
  'Parking Lot',
  'Hostel Block',
  'Admin Building',
];

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterLocation, setFilterLocation] = useState('All');

  // Modals State
  const [showPostModal, setShowPostModal] = useState(false);
  const [activeMatchItem, setActiveMatchItem] = useState(null);
  const [matchesData, setMatchesData] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const [activeClaimItem, setActiveClaimItem] = useState(null);
  const [existingClaims, setExistingClaims] = useState([]);

  // New Report Form State
  const [reportForm, setReportForm] = useState({
    type: 'lost',
    title: '',
    category: CATEGORIES[0],
    location: LOCATIONS[0],
    date: new Date().toISOString().split('T')[0],
    description: '',
    reporterName: '',
    reporterEmail: '',
    reporterPhone: '',
  });

  // Ownership Claim Form State
  const [claimForm, setClaimForm] = useState({
    claimantName: '',
    claimantStudentId: '',
    claimantEmail: '',
    proofOfOwnership: '',
  });

  // Fetch Items from API
  const fetchItems = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (filterType !== 'All') params.append('type', filterType);
      if (filterCategory !== 'All') params.append('category', filterCategory);
      if (filterLocation !== 'All') params.append('location', filterLocation);

      const res = await fetch(`${API_BASE}?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load items');
      setItems(data.data || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [filterType, filterCategory, filterLocation]);

  // Seed Sample Data for Demo
  const handleSeedDemoData = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE}/seed`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to seed data');
      setSuccessMsg('Sample campus lost-and-found items loaded! Try clicking "Smart Matches" on any item.');
      fetchItems();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Submit New Lost/Found Item
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportForm),
      });
      const data = await res.json();
      if (!res.ok) {
        const errDetails = data.errors ? data.errors.join(' | ') : data.message;
        throw new Error(errDetails);
      }
      setSuccessMsg(data.message);
      setShowPostModal(false);
      setReportForm({
        ...reportForm,
        title: '',
        description: '',
      });
      fetchItems();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Open Smart Match Modal & Fetch Suggestions
  const handleOpenMatches = async (item) => {
    setActiveMatchItem(item);
    setLoadingMatches(true);
    setMatchesData([]);
    try {
      const res = await fetch(`${API_BASE}/${item._id}/matches`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMatchesData(data.matches || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoadingMatches(false);
    }
  };

  // Open Ownership Claim Modal & Load Existing Claims
  const handleOpenClaims = async (item) => {
    setActiveClaimItem(item);
    setExistingClaims([]);
    try {
      const res = await fetch(`${API_BASE}/${item._id}/claims`);
      const data = await res.json();
      if (res.ok) setExistingClaims(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Ownership Claim
  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE}/${activeClaimItem._id}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(claimForm),
      });
      const data = await res.json();
      if (!res.ok) {
        const errDetails = data.errors ? data.errors.join(' | ') : data.message;
        throw new Error(errDetails);
      }
      setSuccessMsg('Ownership claim submitted! You can review or approve it below.');
      setClaimForm({
        claimantName: '',
        claimantStudentId: '',
        claimantEmail: '',
        proofOfOwnership: '',
      });
      handleOpenClaims(activeClaimItem);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Approve or Reject Claim
  const handleClaimStatus = async (claimId, status) => {
    try {
      const res = await fetch(`${API_BASE}/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSuccessMsg(`Claim marked as ${status}!`);
      handleOpenClaims(activeClaimItem);
      fetchItems();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const lostCount = items.filter((i) => i.type === 'lost' && i.status === 'open').length;
  const foundCount = items.filter((i) => i.type === 'found' && i.status === 'open').length;
  const resolvedCount = items.filter((i) => i.status === 'resolved').length;

  return (
    <div>
      {/* Navigation Header */}
      <header className="navbar">
        <div className="navbar-container">
          <div className="brand">
            <h1>
              🔎 FindIt
              <span className="badge-dev">Amardeep • 2102508511</span>
            </h1>
            <p>Smart Campus Lost-and-Found Portal with Automated Matching</p>
          </div>
          <div className="nav-actions">
            <button className="btn btn-secondary" onClick={handleSeedDemoData}>
              ⚡ Load Demo Campus Data
            </button>
            <button className="btn btn-primary" onClick={() => setShowPostModal(true)}>
              + Post Lost / Found Item
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        {/* Feedback Banners */}
        {errorMsg && (
          <div className="alert alert-error">
            <span>⚠️ {errorMsg}</span>
            <button className="btn btn-outline" onClick={() => setErrorMsg('')}>
              Dismiss
            </button>
          </div>
        )}
        {successMsg && (
          <div className="alert alert-success">
            <span>✅ {successMsg}</span>
            <button className="btn btn-outline" onClick={() => setSuccessMsg('')}>
              Dismiss
            </button>
          </div>
        )}

        {/* Quick Stats */}
        <section className="stats-grid">
          <div className="stat-card">
            <div>
              <h4>Total Active Reports</h4>
              <div className="stat-num">{items.length}</div>
            </div>
            <span>📋</span>
          </div>
          <div className="stat-card">
            <div>
              <h4>Open Lost Reports</h4>
              <div className="stat-num" style={{ color: '#dc2626' }}>
                {lostCount}
              </div>
            </div>
            <span>🔴</span>
          </div>
          <div className="stat-card">
            <div>
              <h4>Open Found Reports</h4>
              <div className="stat-num" style={{ color: '#059669' }}>
                {foundCount}
              </div>
            </div>
            <span>🟢</span>
          </div>
          <div className="stat-card">
            <div>
              <h4>Items Reunited</h4>
              <div className="stat-num" style={{ color: '#2563eb' }}>
                {resolvedCount}
              </div>
            </div>
            <span>🤝</span>
          </div>
        </section>

        {/* Search & Filter Bar */}
        <section className="filter-bar">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="input-control"
              placeholder="Search by item title, keyword, brand, or reporter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchItems()}
            />
            <button className="btn btn-primary" onClick={fetchItems}>
              Search
            </button>
          </div>

          <select
            className="select-control"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="All">All Types (Lost & Found)</option>
            <option value="lost">🔴 Lost Items Only</option>
            <option value="found">🟢 Found Items Only</option>
          </select>

          <select
            className="select-control"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="select-control"
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
          >
            <option value="All">All Campus Locations</option>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </section>

        {/* Items Grid */}
        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            Loading campus reports...
          </p>
        ) : items.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              background: '#fff',
              padding: '3rem 1.5rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            <h3>No matching reports found</h3>
            <p style={{ color: '#64748b', margin: '0.5rem 0 1.25rem' }}>
              Click "Load Demo Campus Data" in the top bar to populate sample reports or post a new item.
            </p>
            <button className="btn btn-primary" onClick={handleSeedDemoData}>
              ⚡ Load Sample Campus Reports
            </button>
          </div>
        ) : (
          <section className="items-grid">
            {items.map((item) => (
              <article key={item._id} className="item-card">
                <div>
                  <div className="card-top">
                    <span className={`badge badge-${item.type}`}>
                      {item.type === 'lost' ? '🔴 LOST' : '🟢 FOUND'}
                    </span>
                    <span
                      className={`badge ${
                        item.status === 'resolved' ? 'badge-resolved' : ''
                      }`}
                    >
                      {item.status === 'resolved' ? '✅ RESOLVED' : '⏳ OPEN'}
                    </span>
                  </div>

                  <h3 className="item-title">{item.title}</h3>

                  <div className="item-meta">
                    <span>📁 {item.category}</span>
                    <span>📍 {item.location}</span>
                    <span>📅 {new Date(item.date).toLocaleDateString()}</span>
                  </div>

                  <p className="item-desc">{item.description}</p>
                </div>

                <div>
                  <div className="item-reporter">
                    <strong>Reported by:</strong> {item.reporterName} ({item.reporterPhone})
                    <br />
                    <span>✉️ {item.reporterEmail}</span>
                  </div>

                  <div className="card-actions">
                    <button
                      className="btn btn-match"
                      onClick={() => handleOpenMatches(item)}
                    >
                      ✨ Smart Matches
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => handleOpenClaims(item)}
                    >
                      🛡️ Ownership Claims
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      {/* MODAL 1: POST NEW LOST / FOUND ITEM */}
      {showPostModal && (
        <div className="modal-overlay" onClick={() => setShowPostModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Post a Campus Lost or Found Report</h2>
              <button className="btn btn-outline" onClick={() => setShowPostModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleReportSubmit} className="form-grid">
              <div className="form-group">
                <label>Report Type *</label>
                <select
                  className="select-control"
                  value={reportForm.type}
                  onChange={(e) => setReportForm({ ...reportForm, type: e.target.value })}
                >
                  <option value="lost">I Lost an Item</option>
                  <option value="found">I Found an Item</option>
                </select>
              </div>

              <div className="form-group">
                <label>Date Lost / Found *</label>
                <input
                  type="date"
                  className="input-control"
                  required
                  value={reportForm.date}
                  onChange={(e) => setReportForm({ ...reportForm, date: e.target.value })}
                />
              </div>

              <div className="form-group full-width">
                <label>Item Title * (min 3 chars)</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g., Black Sony Wireless Headphones"
                  required
                  value={reportForm.title}
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Category *</label>
                <select
                  className="select-control"
                  value={reportForm.category}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, category: e.target.value })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Campus Location *</label>
                <select
                  className="select-control"
                  value={reportForm.location}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, location: e.target.value })
                  }
                >
                  {LOCATIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label>Detailed Description * (min 10 chars)</label>
                <textarea
                  rows="3"
                  className="textarea-control"
                  placeholder="Include color, brand, distinguishing marks, or exact spot..."
                  required
                  value={reportForm.description}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, description: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Your Name *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Amardeep"
                  required
                  value={reportForm.reporterName}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, reporterName: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Phone Number * (10 digits)</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="9876543210"
                  required
                  value={reportForm.reporterPhone}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, reporterPhone: e.target.value })
                  }
                />
              </div>

              <div className="form-group full-width">
                <label>Campus Email *</label>
                <input
                  type="email"
                  className="input-control"
                  placeholder="student@campus.edu"
                  required
                  value={reportForm.reporterEmail}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, reporterEmail: e.target.value })
                  }
                />
              </div>

              <div className="form-group full-width">
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Submit Campus Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SMART MATCH SUGGESTIONS */}
      {activeMatchItem && (
        <div className="modal-overlay" onClick={() => setActiveMatchItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>✨ Smart Match Suggestions</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Matching opposite reports for: <strong>{activeMatchItem.title}</strong>
                </p>
              </div>
              <button className="btn btn-outline" onClick={() => setActiveMatchItem(null)}>
                ✕
              </button>
            </div>

            {loadingMatches ? (
              <p>Running matching engine across Category, Location, and Date...</p>
            ) : matchesData.length === 0 ? (
              <p style={{ color: '#64748b', padding: '1rem 0' }}>
                No high-confidence matches found yet. Check back as new reports are posted!
              </p>
            ) : (
              matchesData.map(({ item, matchScore, matchReasons }) => (
                <div key={item._id} className="match-item">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span className="match-score-pill">{matchScore}% Match</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0.4rem 0' }}>
                    {item.description}
                  </p>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    📍 {item.location} | 📅 {new Date(item.date).toLocaleDateString()} | 👤{' '}
                    {item.reporterName} ({item.reporterPhone})
                  </div>
                  <div className="reason-tags">
                    {matchReasons.map((r, idx) => (
                      <span key={idx} className="reason-tag">
                        ✓ {r}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: OWNERSHIP CLAIMS */}
      {activeClaimItem && (
        <div className="modal-overlay" onClick={() => setActiveClaimItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>🛡️ Ownership Claims</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Item: <strong>{activeClaimItem.title}</strong>
                </p>
              </div>
              <button className="btn btn-outline" onClick={() => setActiveClaimItem(null)}>
                ✕
              </button>
            </div>

            {activeClaimItem.status !== 'resolved' && (
              <form onSubmit={handleClaimSubmit} style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>Submit a New Ownership Claim</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Your Full Name *</label>
                    <input
                      type="text"
                      className="input-control"
                      required
                      value={claimForm.claimantName}
                      onChange={(e) =>
                        setClaimForm({ ...claimForm, claimantName: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Student ID / Roll No *</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g., 2102508511"
                      required
                      value={claimForm.claimantStudentId}
                      onChange={(e) =>
                        setClaimForm({ ...claimForm, claimantStudentId: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Campus Email *</label>
                    <input
                      type="email"
                      className="input-control"
                      required
                      value={claimForm.claimantEmail}
                      onChange={(e) =>
                        setClaimForm({ ...claimForm, claimantEmail: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>
                      Proof of Ownership * (min 15 chars: serial number, lock screen, sticker, etc.)
                    </label>
                    <textarea
                      rows="2"
                      className="textarea-control"
                      required
                      value={claimForm.proofOfOwnership}
                      onChange={(e) =>
                        setClaimForm({ ...claimForm, proofOfOwnership: e.target.value })
                      }
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Submit Claim Request
                </button>
              </form>
            )}

            <h4 style={{ marginBottom: '0.75rem' }}>
              Submitted Claims ({existingClaims.length})
            </h4>
            {existingClaims.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                No claims submitted for this item yet.
              </p>
            ) : (
              existingClaims.map((c) => (
                <div key={c._id} className="match-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>
                      {c.claimantName} (ID: {c.claimantStudentId})
                    </strong>
                    <span className="badge">{c.status.toUpperCase()}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', margin: '0.4rem 0' }}>
                    <strong>Proof:</strong> {c.proofOfOwnership}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '0.5rem',
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      ✉️ {c.claimantEmail}
                    </span>
                    {c.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
                          onClick={() => handleClaimStatus(c._id, 'approved')}
                        >
                          Approve & Resolve
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
                          onClick={() => handleClaimStatus(c._id, 'rejected')}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
