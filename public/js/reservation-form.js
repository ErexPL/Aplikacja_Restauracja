document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('reservationForm');
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    const guestsInput = document.getElementById('guests');
    const tableMap = document.getElementById('tableMap');

    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;

    async function updateTables() {
        const date = dateInput.value;
        const time = timeInput.value;
        const guests = guestsInput.value;

        if (!date || !time || !guests) return;

        try {
            const response = await fetch(`/api/available-tables?date=${date}&time=${time}&guests=${guests}`);
            const tables = await response.json();

            tableMap.innerHTML = '';
            
            const sections = {
                'window': 'Przy oknie',
                'center': 'Środek sali',
                'garden': 'Ogród'
            };

            Object.entries(sections).forEach(([sectionId, sectionName]) => {
                const sectionDiv = document.createElement('div');
                sectionDiv.className = 'section';
                sectionDiv.innerHTML = `<h3>${sectionName}</h3>`;

                const sectionTables = tables.filter(table => table.section === sectionId);
                const tablesDiv = document.createElement('div');
                tablesDiv.className = 'tables';

                sectionTables.forEach(table => {
                    const tableDiv = document.createElement('div');
                    tableDiv.className = `table ${table.available ? 'available' : 'unavailable'}`;
                    tableDiv.innerHTML = `
                        <span>Stolik ${table.id}</span>
                        <span>(${table.capacity} os.)</span>
                    `;

                    if (table.available) {
                        tableDiv.addEventListener('click', () => selectTable(table.id, tableDiv));
                    }

                    tablesDiv.appendChild(tableDiv);
                });

                sectionDiv.appendChild(tablesDiv);
                tableMap.appendChild(sectionDiv);
            });
        } catch (error) {
            console.error('Error fetching tables:', error);
        }
    }

    function selectTable(tableId, tableDiv) {
        const previousSelected = document.querySelector('.table.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }

        tableDiv.classList.add('selected');
        document.getElementById('tableId').value = tableId;
    }

    dateInput.addEventListener('change', updateTables);
    timeInput.addEventListener('change', updateTables);
    guestsInput.addEventListener('change', updateTables);

    form.addEventListener('submit', function(e) {
        if (!document.getElementById('tableId').value) {
            e.preventDefault();
            alert('Proszę wybrać stolik');
        }
    });
});
